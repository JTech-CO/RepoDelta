(() => {
  'use strict';
  const R = globalThis.RepoDelta;
  const e = R.el;
  R.Panel = class {
    constructor(ref, language = 'en', onSnapshot = () => {}, onStop = () => {}) {
      this.ref = ref; this.lang = language; this.onSnapshot = onSnapshot; this.onStop = onStop;
      this.snapshot = null; this.error = null; this.notice = ''; this.busy = false; this.tab = 'files'; this.query = ''; this.status = 'all'; this.confirmAction = null; this.alive = true;
      this.host = e('div', { id: 'repodelta-panel-host' });
      this.root = this.host.attachShadow({ mode: 'open' });
      this.root.append(e('style', {}, [R.PANEL_CSS]));
      this.dialog = e('dialog', { class: 'rd-dialog', 'aria-labelledby': 'rd-title', 'aria-describedby': 'rd-subtitle' });
      this.root.append(this.dialog); document.body.append(this.host);
      this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.destroy(); });
      this.dialog.addEventListener('click', event => { if (event.target !== this.dialog) return; const r = this.dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) this.destroy(); });
      this.returnFocus = document.activeElement;
    }
    t(key, vars) { return R.t(this.lang, key, vars); }
    async open() { this.render(); this.dialog.showModal(); await this.load(false); }
    destroy() {
      if (!this.alive) return;
      this.alive = false; this.dialog.close(); this.host.remove();
      if (this.returnFocus?.isConnected) this.returnFocus.focus();
      this.onClose?.();
    }
    async call(type, extra = {}) { return R.rpc({ type, ref: this.ref, ...extra }); }
    async load(force) {
      if (this.busy || !this.alive) return;
      this.busy = true; this.error = null; this.notice = ''; this.confirmAction = null; this.render();
      try {
        const snapshot = await this.call('CHECK', { force });
        if (!this.alive) return;
        this.snapshot = snapshot; this.onSnapshot(snapshot);
      } catch (error) { if (this.alive) this.error = error; }
      finally { if (this.alive) { this.busy = false; this.render(); } }
    }
    invalidate(auth = false) {
      if (!this.alive) return;
      if (auth) this.snapshot = null;
      this.error = new R.DeltaError(auth ? 'AUTH_CHANGED' : 'STALE_CHECKPOINT'); this.confirmAction = null; this.render();
    }
    async changeLanguage() {
      try {
        const next = this.lang === 'en' ? 'ko' : 'en';
        await this.call('SET_LANGUAGE', { language: next }); this.lang = next; this.render();
      } catch (error) { this.error = error; this.render(); }
    }
    async more() {
      if (this.busy || !this.snapshot) return;
      this.busy = true; this.error = null; this.render();
      try { const s = await this.call('MORE', { snapshotId: this.snapshot.id }); if (this.alive) { this.snapshot = s; this.onSnapshot(s); } }
      catch (error) { if (this.alive) this.error = error; }
      finally { if (this.alive) { this.busy = false; this.render(); } }
    }
    async commitAction(action) {
      if (this.busy || !this.snapshot) return;
      this.busy = true; this.error = null; this.confirmAction = null; this.render();
      try {
        if (action === 'stop') {
          await this.call('UNTRACK', { revision: this.snapshot.baseline.revision });
          if (this.alive) { this.onStop(); this.destroy(); }
        } else {
          const s = await this.call('MARK', { snapshotId: this.snapshot.id, confirmReset: action === 'reset' });
          if (this.alive) { this.snapshot = s; this.onSnapshot(s); this.notice = 'checkpointSaved'; this.tab = 'files'; }
        }
      } catch (error) { if (this.alive) this.error = error; }
      finally { if (this.alive) { this.busy = false; this.render(); } }
    }
    confirm(action) {
      this.confirmAction = action; this.render();
      this.root.querySelector('[data-confirm-action]')?.focus();
    }
    async copySummary() {
      const s = this.snapshot; if (!s?.diff || !s.baseline) return;
      const lines = [ `RepoDelta | ${s.ref.owner}/${s.ref.repo}`, `${s.baseline.sha}...${s.headSha}`, `${this.t('defaultBranch')}: ${s.repo.defaultBranch}`, `${this.t('checkedAt')}: ${R.date(s.checkedAt, this.lang)}`, this.t('partialCommits', { loaded: s.diff.commits.length, total: s.diff.totalCommits }), ...(s.diff.filesMayBeTruncated ? [this.t('partialFiles')] : []), R.compareUrl(s.repo.ref, s.baseline.sha, s.headSha), '', ...s.diff.files.map(f => `${f.status}: ${f.filename} (+${f.additions} / -${f.deletions})`) ];
      try { await navigator.clipboard.writeText(lines.join('\n')); this.notice = 'copiedSummary'; }
      catch { this.notice = 'clipboardFailed'; }
      this.render();
    }
    render() {
      if (!this.alive) return;
      this.dialog.lang = this.lang;
      const title = e('div', {}, [e('div', { class: 'rd-brand', id: 'rd-title' }, [R.logo('rd-logo', 28), 'RepoDelta']), e('p', { id: 'rd-subtitle' }, [this.t('subtitle')])]);
      const actions = e('div', { class: 'rd-actions' }, [
        R.button(this.lang === 'en' ? 'KR' : 'EN', () => this.changeLanguage(), 'quiet', { title: this.t('chooseLanguage'), 'aria-label': this.t('chooseLanguage'), disabled: this.busy }),
        R.button(this.t('settings'), () => this.call('OPEN_OPTIONS').catch(error => { this.error = error; this.render(); }), 'quiet', { disabled: this.busy }),
        R.button('×', () => this.destroy(), 'quiet rd-close', { 'aria-label': this.t('close') })
      ]);
      const content = e('div', { class: 'rd-content', 'aria-busy': this.busy ? 'true' : 'false' });
      if (this.snapshot) content.append(this.overview());
      else if (this.busy) content.append(e('div', { class: 'rd-loading', role: 'status' }, [e('span', { class: 'rd-spinner', 'aria-hidden': 'true' }), this.t('loading')]));
      if (this.error) content.append(e('div', { class: 'rd-tab-panel' }, [e('div', { class: 'rd-notice error', role: 'alert' }, [R.errorText(this.error, this.lang)]), R.button(this.t('retry'), () => this.load(true), '', { disabled: this.busy })]));
      if (this.notice) content.append(e('div', { class: 'rd-tab-panel' }, [e('div', { class: 'rd-notice success', role: 'status' }, [this.t(this.notice)])]));
      if (this.snapshot?.state === 'ahead' && this.snapshot.diff) content.append(this.tabs(), this.tabPanel());
      const shell = e('div', { class: 'rd-shell' }, [e('header', { class: 'rd-header' }, [title, actions]), content]);
      if (this.confirmAction && this.snapshot) shell.append(this.confirmation());
      shell.append(this.footer());
      const oldScroll = this.root.querySelector('.rd-content')?.scrollTop || 0;
      this.dialog.replaceChildren(shell);
      content.scrollTop = oldScroll;
    }
    overview() {
      const s = this.snapshot;
      const titleKey = { untracked: 'firstTitle', current: 'currentTitle', ahead: 'aheadTitle', empty: 'emptyTitle', 'branch-changed': 'branchTitle', 'identity-changed': 'identityTitle', 'history-changed': 'historyTitle', 'comparison-unavailable': 'comparisonTitle' }[s.state];
      const bodyKey = { untracked: 'firstBody', current: 'currentBody', ahead: 'aheadBody', empty: 'emptyBody', 'branch-changed': 'branchBody', 'identity-changed': 'identityBody', 'history-changed': 'historyBody', 'comparison-unavailable': 'comparisonBody' }[s.state];
      const warning = s.state.includes('changed') || s.state === 'comparison-unavailable';
      const vars = { count: s.diff?.totalCommits || 0, old: s.baseline?.branch || '', current: s.repo.defaultBranch };
      const box = e('section', { class: 'rd-overview' }, [
        e('div', { class: 'rd-eyebrow' }, [R.link(`${s.repo.ref.owner}/${s.repo.ref.repo}`, R.repoUrl(s.repo.ref)), e('span', { class: 'rd-pill', title: this.t('defaultOnly') }, [`${this.t('defaultBranch')}: ${s.repo.defaultBranch}`]), s.repo.private ? e('span', { class: 'rd-pill' }, [this.t('private')]) : null]),
        e('h1', { class: warning ? 'rd-warning-title' : '' }, [this.t(titleKey, vars)]), e('p', { class: 'rd-lead' }, [this.t(bodyKey, vars)])
      ]);
      if (s.headSha) {
        const cp = e('div', {}, [e('div', { class: 'rd-label' }, [this.t('checkpoint')]), e('div', { class: 'rd-value' }, [s.baseline ? R.link(R.shortSha(s.baseline.sha), R.commitUrl(s.repo.ref, s.baseline.sha)) : this.t('newCheckpoint')]), e('small', {}, [s.baseline ? R.date(s.baseline.markedAt, this.lang) : this.t('notTracked')])]);
        const head = e('div', {}, [e('div', { class: 'rd-label' }, [this.t('checkedHead')]), e('div', { class: 'rd-value' }, [R.link(R.shortSha(s.headSha), R.commitUrl(s.repo.ref, s.headSha))]), e('small', {}, [R.date(s.checkedAt, this.lang)])]);
        box.append(e('div', { class: 'rd-checkpoints' }, [cp, e('span', { class: 'rd-arrow', 'aria-hidden': 'true' }, ['→']), head]));
      }
      box.append(e('div', { class: 'rd-meta' }, [`${this.t('checkedAt')}: ${R.date(s.checkedAt, this.lang)} · ${s.cached ? this.t('cacheNote') + ' · ' : ''}${this.t('observed')}`]));
      if (s.state === 'ahead' && s.diff) {
        const files = s.diff.files;
        const adds = files.reduce((a,f) => a + f.additions, 0); const dels = files.reduce((a,f) => a + f.deletions, 0);
        box.append(e('div', { class: 'rd-stats', title: this.t('loadedStats') }, [
          e('div', { class: 'rd-stat' }, [e('strong', {}, [files.length + (s.diff.filesMayBeTruncated ? '+' : '')]), this.t('files')]),
          e('div', { class: 'rd-stat rd-positive', 'aria-label': `${this.t('additions')}: ${adds}` }, [e('strong', {}, [`+${adds.toLocaleString()}`])]),
          e('div', { class: 'rd-stat rd-negative', 'aria-label': `${this.t('deletions')}: ${dels}` }, [e('strong', {}, [`-${dels.toLocaleString()}`])])
        ]));
        if (s.diff.filesMayBeTruncated) box.append(e('div', { class: 'rd-notice' }, [this.t('partialFiles')]));
      }
      return box;
    }
    tabs() {
      const d = this.snapshot.diff;
      const tabs = e('div', { class: 'rd-tabs', role: 'tablist', 'aria-label': this.t('changes') });
      for (const key of ['files','commits']) {
        const count = key === 'files' ? d.files.length + (d.filesMayBeTruncated ? '+' : '') : d.totalCommits;
        const button = R.button('', () => { this.tab = key; this.render(); this.root.getElementById(`rd-tab-${key}`).focus(); }, 'rd-tab', { id: `rd-tab-${key}`, role: 'tab', 'aria-selected': String(this.tab === key), 'aria-controls': 'rd-tab-panel', tabindex: this.tab === key ? '0' : '-1' });
        button.append(this.t(key), e('span', {}, [count]));
        button.addEventListener('keydown', event => {
          if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
            event.preventDefault(); this.tab = event.key === 'Home' ? 'files' : event.key === 'End' ? 'commits' : this.tab === 'files' ? 'commits' : 'files'; this.render(); this.root.getElementById(`rd-tab-${this.tab}`).focus();
          }
        }); tabs.append(button);
      }
      return tabs;
    }
    tabPanel() {
      const panel = e('section', { class: 'rd-tab-panel', id: 'rd-tab-panel', role: 'tabpanel', 'aria-labelledby': `rd-tab-${this.tab}`, tabindex: '0' });
      if (this.tab === 'files') {
        const search = e('input', { type: 'search', placeholder: this.t('searchFiles'), 'aria-label': this.t('searchFiles'), value: this.query, onInput: event => { this.query = event.target.value; this.renderFiles(); } });
        const select = e('select', { 'aria-label': this.t('statusLabel'), onChange: event => { this.status = event.target.value; this.renderFiles(); } }, ['all','added','modified','removed','renamed','copied','changed','unchanged'].map(value => e('option', { value }, [this.t(value)]))); select.value = this.status;
        panel.append(e('div', { class: 'rd-filter' }, [search, select]), e('div', { id: 'rd-file-results' }));
        queueMicrotask(() => { if (this.alive) this.renderFiles(); });
      } else {
        const diff = this.snapshot.diff;
        panel.append(e('p', { class: 'rd-note' }, [this.t('partialCommits', { loaded: diff.commits.length, total: diff.totalCommits })]));
        const list = e('ul', { class: 'rd-commit-list' });
        for (const c of diff.commits) {
          list.append(e('li', { class: 'rd-commit' }, [e('div', {}, [R.link(c.message || R.shortSha(c.sha), R.commitUrl(this.snapshot.repo.ref, c.sha), { class: 'rd-commit-title' }), e('small', {}, [`${c.author} · ${R.date(c.date, this.lang)}`])]), R.link(R.shortSha(c.sha), R.commitUrl(this.snapshot.repo.ref, c.sha), { class: 'rd-sha' })]));
        }
        panel.append(list, e('p', { class: 'rd-note' }, [this.t('commitOrder')]));
        if (diff.commits.length < diff.totalCommits && diff.commits.length < R.LIMITS.commits) panel.append(R.button(this.busy ? this.t('loadingMore') : this.t('loadMore'), () => this.more(), '', { disabled: this.busy }));
        if (diff.commits.length >= R.LIMITS.commits && diff.totalCommits > diff.commits.length) panel.append(e('div', { class: 'rd-notice' }, [this.t('commitCap')]));
      }
      return panel;
    }
    renderFiles() {
      const target = this.root.getElementById('rd-file-results'); const s = this.snapshot;
      if (!target || !s?.diff) return;
      const files = R.filterFiles(s.diff.files, this.query, this.status);
      const list = e('ul', { class: 'rd-file-list' });
      for (const f of files) {
        const removed = f.status === 'removed'; const sha = removed ? s.baseline.sha : s.headSha;
        list.append(e('li', { class: 'rd-file' }, [
          e('span', { class: `rd-file-state ${f.status}`, title: this.t(f.status), 'aria-label': this.t(f.status) }, [({ added:'A', modified:'M', removed:'D', renamed:'R', copied:'C', changed:'M', unchanged:'=' })[f.status]]),
          e('div', {}, [R.link(f.filename, R.fileUrl(s.repo.ref, sha, f.filename), { title: this.t(removed ? 'fileAtBase' : 'fileAtHead') }), f.previousFilename ? e('small', {}, [`${this.t('renameFrom')}: ${f.previousFilename}`]) : null]),
          e('span', { class: 'rd-line-count' }, [e('span', { class: 'rd-positive' }, [`+${f.additions}`]), e('span', { class: 'rd-negative' }, [`-${f.deletions}`])])
        ]));
      }
      target.replaceChildren(e('p', { class: 'rd-note' }, [this.t('fileDisplay', { shown: files.length, total: s.diff.files.length })]), files.length ? list : e('div', { class: 'rd-empty' }, [this.t('noFiles')]), e('p', { class: 'rd-note' }, [this.t('scopeNote')]));
    }
    confirmation() {
      const s = this.snapshot; const action = this.confirmAction;
      const text = action === 'stop' ? this.t('stopQuestion') : action === 'reset' ? this.t('resetQuestion', { sha: R.shortSha(s.headSha) }) : this.t('markQuestion', { sha: R.shortSha(s.headSha), branch: s.repo.defaultBranch });
      const partial = action !== 'stop' && s.diff && (s.diff.filesMayBeTruncated || s.diff.commits.length < s.diff.totalCommits);
      return e('section', { class: 'rd-confirm', 'aria-label': this.t('confirm') }, [e('p', {}, [text]), partial ? e('p', { class: 'rd-note' }, [this.t('partialAck')]) : null, e('div', { class: 'rd-actions' }, [R.button(this.t('cancel'), () => { this.confirmAction = null; this.render(); }), R.button(this.t('confirm'), () => this.commitAction(action), action === 'stop' ? 'danger' : 'primary', { 'data-confirm-action': 'true', disabled: this.busy })])]);
    }
    footer() {
      const s = this.snapshot; const left = e('div', { class: 'rd-actions' });
      const right = e('div', { class: 'rd-actions' });
      if (s?.baseline && s.headSha && s.baseline.repoId === s.repo.id) left.append(R.link(this.t('openCompare'), R.compareUrl(s.repo.ref, s.baseline.sha, s.headSha)));
      if (s?.state === 'ahead') left.append(R.button(this.t('copySummary'), () => this.copySummary(), 'quiet', { disabled: this.busy }));
      if (!s) left.append(e('span', { class: 'rd-note' }, [this.t('localOnly')]));
      if (s?.baseline) right.append(R.button(this.t('stop'), () => this.confirm('stop'), 'quiet', { disabled: this.busy || Boolean(this.error) }));
      if (s) right.append(R.button(this.busy ? this.t('checkLoading') : this.t('refresh'), () => this.load(true), '', { disabled: this.busy }));
      if (s?.headSha && s.state !== 'current') {
        const action = s.state === 'untracked' ? 'start' : s.state === 'ahead' ? 'mark' : 'reset';
        right.append(R.button(this.t(action), () => action === 'start' ? this.commitAction('start') : this.confirm(action), 'primary', { disabled: this.busy || Boolean(this.error) }));
      }
      return e('footer', { class: 'rd-footer' }, [left, right]);
    }
  };
})();
