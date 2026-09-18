/* Checkpoint transactions always acknowledge a previously displayed, pinned SHA. */
(() => {
  'use strict';
  const R = globalThis.RepoDelta;
  const pathFor = ref => `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  const revision = cp => cp?.revision || null;
  R.DeltaService = class {
    constructor(store, api, now = Date.now) { this.store = store; this.api = api; this.now = now; this.mutations = R.createQueue(); }
    async boot(ref) { return { settings: await this.store.settings(), checkpoint: await this.store.checkpoint(ref) }; }
    async check(ref, force = false) {
      ref = R.validateRef(ref);
      const epoch = (await this.store.auth()).epoch;
      const baseline = await this.store.checkpoint(ref);
      const meta = await this.api.get(pathFor(ref), 'repo', force);
      const repo = meta.data;
      let head;
      try { head = await this.api.get(`${pathFor(repo.ref)}/commits?sha=${encodeURIComponent(repo.defaultBranch)}&per_page=1`, 'head', force); }
      catch (e) { if (e.code !== 'CONFLICT') throw e; head = { data: [], at: this.now(), cached: false }; }
      const headSha = head.data[0]?.sha || null;
      let diff = null;
      if (baseline && headSha && baseline.repoId === repo.id && baseline.branch === repo.defaultBranch && baseline.sha !== headSha) {
        try { diff = (await this.api.get(`${pathFor(repo.ref)}/compare/${baseline.sha}...${headSha}?per_page=100&page=1`, 'compare', force)).data; }
        catch (e) { if (!['NOT_FOUND','CONFLICT','UNPROCESSABLE'].includes(e.code)) throw e; }
      }
      // A concurrent tab may have acknowledged a checkpoint during the request.
      R.assert(revision(await this.store.checkpoint(ref)) === revision(baseline), 'STALE_CHECKPOINT');
      R.assert((await this.store.auth()).epoch === epoch, 'AUTH_CHANGED');
      const state = R.classify(baseline, repo, headSha, diff);
      const snapshot = {
        id: crypto.randomUUID(), ref, repo, baseline, headSha, state,
        createdAt: this.now(), checkedAt: head.at, cached: head.cached, epoch,
        diff, pagesLoaded: diff ? 1 : 0
      };
      await this.store.saveSnapshot(snapshot);
      return this.publicSnapshot(snapshot);
    }
    publicSnapshot(s) {
      // Authentication epoch is internal and never sent to GitHub page scripts.
      const { epoch, ...publicData } = s; return publicData;
    }
    async loadMore(ref, id) {
      const s = await this.store.snapshot(id);
      R.assert(R.repoKey(s.ref) === R.repoKey(ref), 'FORBIDDEN');
      R.assert(s.state === 'ahead' && s.diff && s.diff.commits.length < s.diff.totalCommits && s.diff.commits.length < R.LIMITS.commits, 'NO_MORE_PAGES');
      R.assert(revision(await this.store.checkpoint(ref)) === revision(s.baseline), 'STALE_CHECKPOINT');
      const page = s.pagesLoaded + 1;
      const result = await this.api.get(`${pathFor(s.repo.ref)}/compare/${s.baseline.sha}...${s.headSha}?per_page=100&page=${page}`, 'compare');
      R.assert(result.data.status === 'ahead' && result.data.totalCommits === s.diff.totalCommits, 'BAD_RESPONSE');
      const seen = new Set(s.diff.commits.map(c => c.sha));
      const fresh = result.data.commits.filter(c => !seen.has(c.sha));
      R.assert(fresh.length > 0, 'PAGINATION_INCOMPLETE');
      s.diff.commits.push(...fresh); s.diff.commits = s.diff.commits.slice(0, R.LIMITS.commits); s.pagesLoaded = page;
      await this.store.saveSnapshot(s); return this.publicSnapshot(s);
    }
    async mark(ref, id, confirmReset = false) {
      return this.mutations(async () => {
        const s = await this.store.snapshot(id);
        R.assert(R.repoKey(s.ref) === R.repoKey(ref), 'FORBIDDEN');
        R.assert(R.isSha(s.headSha), 'EMPTY_REPO');
        const reset = !['untracked','ahead','current'].includes(s.state);
        R.assert(!reset || confirmReset === true, 'RESET_CONFIRM_REQUIRED');
        const cp = { ref: R.validateRef(s.ref), repoId: s.repo.id, branch: s.repo.defaultBranch, sha: s.headSha, markedAt: new Date(this.now()).toISOString(), revision: crypto.randomUUID() };
        await this.store.mutateCheckpoints(records => {
          const key = R.repoKey(ref);
          R.assert(revision(records[key]) === revision(s.baseline), 'STALE_CHECKPOINT');
          records[key] = cp;
        });
        // Deliberately do not fetch a newer HEAD here. The user acknowledged s.headSha.
        const next = { ...s, id: crypto.randomUUID(), createdAt: this.now(), baseline: cp, state: 'current', diff: null, pagesLoaded: 0 };
        await this.store.saveSnapshot(next); return this.publicSnapshot(next);
      });
    }
    async untrack(ref, expectedRevision) {
      return this.mutations(() => this.store.mutateCheckpoints(records => {
        const key = R.repoKey(ref);
        R.assert(typeof expectedRevision === 'string' && records[key]?.revision === expectedRevision, 'STALE_CHECKPOINT');
        delete records[key]; return { removed: true };
      }));
    }
    async setToken(value) {
      R.assert(typeof value === 'string' && (value === '' || /^[A-Za-z0-9_-]{20,255}$/.test(value)), 'INVALID_TOKEN');
      return this.mutations(async () => { this.api.cancel(); return this.store.setToken(value); });
    }
    async importBackup(text) {
      const imported = R.parseBackup(text);
      return this.mutations(() => this.store.mutateCheckpoints(records => {
        let added = 0, skipped = 0;
        for (const cp of imported) {
          const key = R.repoKey(cp.ref);
          if (records[key]) { skipped++; continue; }
          records[key] = { ...cp, revision: crypto.randomUUID() }; added++;
        }
        return { added, skipped };
      }));
    }
    async diagnoseApi() { return this.api.diagnose(); }
    async options() {
      return { settings: await this.store.settings(), checkpoints: Object.values(await this.store.checkpoints()).sort((a,b) => b.markedAt.localeCompare(a.markedAt)), hasToken: Boolean((await this.store.auth()).token), rate: await this.store.rate() };
    }
  };
  R.authorizeMessage = (message, sender, runtimeId) => {
    R.assert(R.isObject(message) && message.namespace === 'RepoDelta' && sender?.id === runtimeId, 'FORBIDDEN');
    const prefix = `chrome-extension://${runtimeId}/`;
    const trusted = typeof sender.url === 'string' && sender.url.startsWith(prefix);
    const contentOps = new Set(['BOOT','CHECK','MORE','MARK','UNTRACK','OPEN_OPTIONS','SET_LANGUAGE']);
    const trustedOps = new Set([...contentOps,'OPTIONS','SET_SETTINGS','SET_TOKEN','DIAGNOSE_API','EXPORT','IMPORT','CLEAR_CACHE','CLEAR_CHECKPOINTS']);
    R.assert((trusted ? trustedOps : contentOps).has(message.type), 'FORBIDDEN');
    if (!trusted) {
      const pageRef = R.parseRepoUrl(sender.url);
      R.assert(sender.tab && pageRef, 'FORBIDDEN');
      R.assert(R.repoKey(pageRef) === R.repoKey(message.ref), 'FORBIDDEN');
      R.assert(sender.frameId === 0 || sender.frameId === undefined, 'FORBIDDEN');
    }
    return trusted;
  };
  R.dispatch = async (m, sender, service, runtimeId, openOptions = () => {}) => {
    R.authorizeMessage(m, sender, runtimeId);
    const ref = m.ref ? R.validateRef(m.ref) : null;
    switch (m.type) {
      case 'BOOT': return service.boot(ref);
      case 'CHECK': return service.check(ref, m.force === true);
      case 'MORE': return service.loadMore(ref, m.snapshotId);
      case 'MARK': return service.mark(ref, m.snapshotId, m.confirmReset === true);
      case 'UNTRACK': return service.untrack(ref, m.revision);
      case 'OPEN_OPTIONS': await openOptions(); return {};
      case 'OPTIONS': return service.options();
      case 'SET_SETTINGS': return service.store.setSettings(m.settings);
      case 'SET_LANGUAGE':
        R.assert(['en','ko'].includes(m.language));
        return service.store.setSettings({ ...await service.store.settings(), language: m.language });
      case 'SET_TOKEN': return service.setToken(m.token);
      case 'DIAGNOSE_API': return service.diagnoseApi();
      case 'EXPORT': return { text: R.serializeBackup(Object.values(await service.store.checkpoints())) };
      case 'IMPORT': return service.importBackup(m.text);
      case 'CLEAR_CACHE': await service.store.clearCache(); return {};
      case 'CLEAR_CHECKPOINTS':
        R.assert(m.confirm === true, 'RESET_CONFIRM_REQUIRED');
        return service.mutations(() => service.store.mutateCheckpoints(records => { for (const k of Object.keys(records)) delete records[k]; return {}; }));
      default: R.fail('FORBIDDEN');
    }
  };
})();
