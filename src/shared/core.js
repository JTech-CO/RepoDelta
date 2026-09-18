/* RepoDelta | MIT | Shared pure functions. No page-world bridge. */
(() => {
  'use strict';
  const R = globalThis.RepoDelta ||= {};
  R.VERSION = '1.0.4';
  R.API_VERSION = '2022-11-28';
  R.LIMITS = Object.freeze({ checkpoints: 1000, commits: 500, pageSize: 100, files: 300, cacheMs: 300000, snapshotMs: 1800000, importBytes: 1048576 });
  R.DEFAULT_SETTINGS = Object.freeze({ language: 'en', autoCheck: true });
  const RESERVED = new Set(['about','account','apps','codespaces','collections','contact','dashboard','enterprise','events','explore','features','issues','join','login','logout','marketplace','new','notifications','orgs','organizations','pricing','pulls','readme','search','security','sessions','settings','site','sponsors','topics','trending','users']);
  class DeltaError extends Error {
    constructor(code, status = 0, retryAt = 0, detail = '') {
      super(code);
      this.name = 'DeltaError';
      this.code = code;
      this.status = status;
      this.retryAt = retryAt;
      this.detail = typeof detail === 'string' ? detail.slice(0, 240) : '';
    }
  }
  R.DeltaError = DeltaError;
  R.fail = (code, status = 0, retryAt = 0, detail = '') => { throw new DeltaError(code, status, retryAt, detail); };
  R.assert = (condition, code = 'INVALID_INPUT') => { if (!condition) R.fail(code); };
  R.isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  R.isSha = x => typeof x === 'string' && /^[a-f0-9]{40}$/i.test(x);
  R.validateRef = value => {
    R.assert(R.isObject(value) && typeof value.owner === 'string' && typeof value.repo === 'string');
    R.assert(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,99})$/.test(value.owner));
    R.assert(/^[A-Za-z0-9_.-]{1,100}$/.test(value.repo) && !/^\.{1,2}$/.test(value.repo));
    return { owner: value.owner, repo: value.repo };
  };
  R.repoKey = ref => { const r = R.validateRef(ref); return `${r.owner}/${r.repo}`.toLowerCase(); };
  R.repoUrl = ref => { const r = R.validateRef(ref); return `https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}`; };
  R.parseRepoUrl = value => {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password) return null;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length < 2 || RESERVED.has(parts[0].toLowerCase())) return null;
      return R.validateRef({ owner: decodeURIComponent(parts[0]), repo: decodeURIComponent(parts[1]).replace(/\.git$/i, '') });
    } catch { return null; }
  };
  R.shortSha = sha => typeof sha === 'string' ? sha.slice(0, 7) : '';
  R.compareUrl = (ref, base, head) => { R.assert(R.isSha(base) && R.isSha(head)); return `${R.repoUrl(ref)}/compare/${base}...${head}`; };
  R.commitUrl = (ref, sha) => { R.assert(R.isSha(sha)); return `${R.repoUrl(ref)}/commit/${sha}`; };
  R.fileUrl = (ref, sha, path) => {
    R.assert(R.isSha(sha) && typeof path === 'string');
    return `${R.repoUrl(ref)}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`;
  };
  R.isBranch = v => typeof v === 'string' && v.length > 0 && v.length <= 1024 && !/[\x00-\x20\x7f]/.test(v);
  R.cleanSettings = v => ({ language: ['en','ko'].includes(v?.language) ? v.language : 'en', autoCheck: typeof v?.autoCheck === 'boolean' ? v.autoCheck : true });
  R.publicError = e => ({
    code: e instanceof DeltaError ? e.code : 'INTERNAL',
    status: e instanceof DeltaError ? e.status : 0,
    retryAt: e instanceof DeltaError ? e.retryAt : 0,
    detail: e instanceof DeltaError ? e.detail : ''
  });
  R.nonNegative = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  R.text = (s, length = 500) => typeof s === 'string' ? s.slice(0, length) : '';
  R.normalizeRepo = data => {
    R.assert(R.isObject(data) && Number.isSafeInteger(data.id) && data.id > 0 && R.isBranch(data.default_branch), 'BAD_RESPONSE');
    const ref = R.validateRef({ owner: data.owner?.login, repo: data.name });
    return { id: data.id, ref, defaultBranch: data.default_branch, private: data.private === true, archived: data.archived === true };
  };
  R.normalizeCommits = data => {
    R.assert(Array.isArray(data), 'BAD_RESPONSE');
    return data.slice(0, R.LIMITS.pageSize).map(c => {
      R.assert(R.isSha(c?.sha), 'BAD_RESPONSE');
      return { sha: c.sha.toLowerCase(), message: R.text(c.commit?.message, 1000).split('\n')[0], author: R.text(c.author?.login || c.commit?.author?.name, 100), date: R.text(c.commit?.committer?.date || c.commit?.author?.date, 40) };
    });
  };
  R.normalizeCompare = data => {
    R.assert(R.isObject(data) && ['ahead','behind','diverged','identical'].includes(data.status) && Number.isSafeInteger(data.total_commits), 'BAD_RESPONSE');
    const files = Array.isArray(data.files) ? data.files.slice(0, R.LIMITS.files).map(f => {
      R.assert(typeof f?.filename === 'string', 'BAD_RESPONSE');
      return { filename: R.text(f.filename, 4096), previousFilename: R.text(f.previous_filename, 4096), status: ['added','modified','removed','renamed','copied','changed','unchanged'].includes(f.status) ? f.status : 'changed', additions: R.nonNegative(f.additions), deletions: R.nonNegative(f.deletions) };
    }) : [];
    return { status: data.status, aheadBy: R.nonNegative(data.ahead_by), behindBy: R.nonNegative(data.behind_by), totalCommits: R.nonNegative(data.total_commits), mergeBase: R.isSha(data.merge_base_commit?.sha) ? data.merge_base_commit.sha.toLowerCase() : null, commits: R.normalizeCommits(data.commits || []), files, filesMayBeTruncated: files.length >= R.LIMITS.files };
  };
  R.classify = (baseline, repo, head, comparison) => {
    if (!head) return 'empty';
    if (!baseline) return 'untracked';
    if (baseline.repoId !== repo.id) return 'identity-changed';
    if (baseline.branch !== repo.defaultBranch) return 'branch-changed';
    if (baseline.sha === head) return 'current';
    if (!comparison) return 'comparison-unavailable';
    if (comparison.status === 'ahead' && comparison.behindBy === 0 && comparison.mergeBase === baseline.sha) return 'ahead';
    return 'history-changed';
  };
  R.filterFiles = (files, query = '', status = 'all') => {
    const q = query.trim().toLocaleLowerCase();
    return files.filter(f => (status === 'all' || f.status === status) && (!q || `${f.filename}\n${f.previousFilename || ''}`.toLocaleLowerCase().includes(q)));
  };
  R.validateCheckpoint = raw => {
    R.assert(R.isObject(raw));
    const ref = R.validateRef(raw.ref);
    R.assert(Number.isSafeInteger(raw.repoId) && raw.repoId > 0 && R.isBranch(raw.branch) && R.isSha(raw.sha));
    R.assert(typeof raw.markedAt === 'string' && Number.isFinite(Date.parse(raw.markedAt)) && raw.markedAt.length <= 40);
    return { ref, repoId: raw.repoId, branch: raw.branch, sha: raw.sha.toLowerCase(), markedAt: new Date(raw.markedAt).toISOString() };
  };
  R.parseBackup = text => {
    R.assert(typeof text === 'string' && new TextEncoder().encode(text).length <= R.LIMITS.importBytes, 'INVALID_BACKUP');
    let data; try { data = JSON.parse(text); } catch { R.fail('INVALID_BACKUP'); }
    R.assert(data?.app === 'RepoDelta' && data.schemaVersion === 1 && Array.isArray(data.checkpoints) && data.checkpoints.length <= R.LIMITS.checkpoints, 'INVALID_BACKUP');
    try { return data.checkpoints.map(R.validateCheckpoint); } catch { R.fail('INVALID_BACKUP'); }
  };
  R.serializeBackup = checkpoints => JSON.stringify({ app: 'RepoDelta', schemaVersion: 1, exportedAt: new Date().toISOString(), checkpoints: checkpoints.map(R.validateCheckpoint) }, null, 2);
  R.createQueue = () => {
    let tail = Promise.resolve();
    return task => { const result = tail.then(task, task); tail = result.catch(() => {}); return result; };
  };
})();
