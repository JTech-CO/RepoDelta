(() => {
  'use strict';
  const R = globalThis.RepoDelta, e = R.el;
  let data = null, lang = 'en', query = '', busy = false;
  const app = document.getElementById('app');
  const t = (key, vars) => R.t(lang, key, vars);
  const probeText = probe => {
    if (!probe) return '—';
    if (probe.status) {
      const parts = [`HTTP ${probe.status}`, `${probe.elapsedMs ?? 0} ms`];
      if (probe.message) parts.push(probe.message);
      return parts.join(' · ');
    }
    return probe.error || 'No HTTP response';
  };
  function renderDiagnostics(result) {
    const out = document.getElementById('api-diag-output');
    if (!out) return;
    const rows = [
      `${result.hostPermission ? t('apiDiagPermissionYes') : t('apiDiagPermissionNo')}`,
      result.hasToken ? t('apiDiagToken') : t('apiDiagNoToken'),
      `${t('apiDiagMinimal')}: ${probeText(result.minimal)}`,
      `${t('apiDiagVersioned')}: ${probeText(result.versioned)}`,
      `${t('apiDiagAuthenticated')}: ${probeText(result.authenticated)}`
    ];
    out.className = `notice${result.minimal?.ok ? '' : ' error'}`;
    out.replaceChildren(...rows.map((row, index) => e('div', { class: index < 2 ? 'diag-meta' : 'diag-row' }, [row])));
  }
  async function runDiagnostics() {
    const button = document.getElementById('api-diag-run');
    if (button) button.disabled = true;
    try {
      const result = await R.rpc({ type: 'DIAGNOSE_API' });
      renderDiagnostics(result);
      flash(t('apiDiagSuccess'));
    } catch (error) {
      flash(R.errorText(error, lang), true);
    } finally {
      if (button) button.disabled = false;
    }
  }
  async function repairApiAccess() {
    const button = document.getElementById('api-diag-repair');
    if (button) button.disabled = true;
    try {
      const granted = await chrome.permissions.request({ origins: ['https://api.github.com/*'] });
      flash(t(granted ? 'apiDiagRepairDone' : 'apiDiagRepairDenied'), !granted);
      if (granted) await runDiagnostics();
    } catch (error) {
      flash(error?.message || t('apiDiagRepairDenied'), true);
    } finally {
      if (button) button.disabled = false;
    }
  }
  function flash(text, error = false) { const box = document.getElementById('flash'); if (!box) return; box.className = `notice${error ? ' error' : ''}`; box.textContent = text; box.setAttribute('role', error ? 'alert' : 'status'); }
  async function refresh() { data = await R.rpc({ type: 'OPTIONS' }); lang = data.settings.language; render(); }
  async function run(task, success) {
    if (busy) return; busy = true; for (const b of app.querySelectorAll('button')) b.disabled = true;
    try { const result = await task(); await refresh(); if (success) flash(typeof success === 'function' ? success(result) : t(success)); }
    catch (error) { flash(R.errorText(error, lang), true); }
    finally { busy = false; for (const b of app.querySelectorAll('button')) b.disabled = false; }
  }
  function confirm(text, task) {
    const dialog = e('dialog', { class: 'dialog', 'aria-labelledby': 'rd-confirm-text' }, [e('p', { id: 'rd-confirm-text' }, [text])]);
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.append(e('div', { class: 'actions' }, [R.button(t('cancel'), close), R.button(t('confirm'), () => { close(); task(); }, 'danger')]));
    dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
  }
  function render() {
    document.documentElement.lang = lang;
    const settings = e('section', { class: 'card' }, [e('h2', {}, [t('preferences')])]);
    const select = e('select', { id: 'language', 'aria-label': t('chooseLanguage'), onChange: event => run(() => R.rpc({ type: 'SET_SETTINGS', settings: { ...data.settings, language: event.target.value } }), 'savedPrefs') }, [e('option', { value: 'en' }, ['English']), e('option', { value: 'ko' }, ['한국어'])]); select.value = lang;
    const checkbox = e('input', { type: 'checkbox', id: 'autoCheck', checked: data.settings.autoCheck, onChange: event => run(() => R.rpc({ type: 'SET_SETTINGS', settings: { ...data.settings, autoCheck: event.target.checked } }), 'savedPrefs') });
    settings.append(e('div', { class: 'row' }, [e('label', { for: 'language' }, [t('chooseLanguage')]), select]), e('div', { class: 'check' }, [checkbox, e('label', { for: 'autoCheck' }, [t('automatic')])]), e('p', { class: 'muted', style: 'margin-top:10px' }, [t('automaticHint')]));
    const token = e('section', { class: 'card' }, [e('h2', {}, [t('tokenTitle'), e('span', { class: 'pill' }, [t('session')])]), e('p', { class: 'muted' }, [t('tokenIntro')]), e('label', { for: 'token', class: 'token-label' }, [t('tokenLabel')])]);
    const field = e('input', { class: 'field', type: 'password', id: 'token', placeholder: t('tokenPlaceholder'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '255' });
    const saveToken = () => { const value = field.value.trim(); if (!value) { flash(R.errorText({ code: 'INVALID_TOKEN' }, lang), true); return; } field.value = ''; run(() => R.rpc({ type: 'SET_TOKEN', token: value }), 'tokenSaved'); };
    field.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); saveToken(); } });
    token.append(field, e('div', { class: 'actions' }, [R.button(t('tokenSave'), saveToken, 'primary'), R.button(t('tokenRemove'), () => run(() => R.rpc({ type: 'SET_TOKEN', token: '' }), 'tokenRemoved'))]), e('p', { class: 'muted', style: 'margin-top:12px', id: 'token-status' }, [t(data.hasToken ? 'tokenPresent' : 'tokenAbsent')]), e('div', { class: 'notice' }, [t('tokenWarning')]), R.link(t('tokenHelp'), 'https://github.com/settings/personal-access-tokens/new', { class: 'muted' }));
    if (data.rate.remaining !== null && data.rate.remaining !== undefined) token.append(e('p', { class: 'muted', style: 'margin-top:12px' }, [t('rateInfo', { remaining: data.rate.remaining, limit: data.rate.limit ?? '?' })]));
    const diagnostics = e('section', { class: 'card' }, [
      e('h2', {}, [t('apiDiagTitle')]),
      e('p', { class: 'muted' }, [t('apiDiagIntro')]),
      e('div', { class: 'actions' }, [
        R.button(t('apiDiagRun'), runDiagnostics, 'primary', { id: 'api-diag-run' }),
        R.button(t('apiDiagRepair'), repairApiAccess, '', { id: 'api-diag-repair' })
      ]),
      e('div', { id: 'api-diag-output', class: 'diag-output', 'aria-live': 'polite' })
    ]);
    const repos = e('section', { class: 'card' }, [e('h2', {}, [t('checkpointsTitle'), e('span', { class: 'count' }, [data.checkpoints.length])]), e('input', { type: 'search', class: 'field', placeholder: t('checkpointSearch'), 'aria-label': t('checkpointSearch'), value: query, onInput: event => { query = event.target.value; renderRepos(); } }), e('div', { id: 'repo-results' })]);
    const fileInput = e('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': t('import') });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]; if (!file) return;
      run(async () => { R.assert(file.size <= R.LIMITS.importBytes, 'INVALID_BACKUP'); return R.rpc({ type: 'IMPORT', text: await file.text() }); }, result => t('imported', result));
    });
    const backup = e('section', { class: 'card' }, [e('h2', {}, [t('backupTitle')]), e('p', { class: 'muted' }, [t('backupIntro')]), e('div', { class: 'actions' }, [
      R.button(t('export'), () => run(async () => { const value = await R.rpc({ type: 'EXPORT' }); R.download(`RepoDelta-checkpoints-${new Date().toISOString().slice(0,10)}.json`, value.text); }, 'exportSaved')),
      R.button(t('import'), () => fileInput.click()), fileInput
    ]), e('p', { class: 'muted', style: 'margin-top:12px' }, [t('importHint')]), e('div', { class: 'actions' }, [
      R.button(t('clearCache'), () => run(() => R.rpc({ type: 'CLEAR_CACHE' }), 'cacheCleared')),
      R.button(t('clearCheckpoints'), () => confirm(t('clearQuestion'), () => run(() => R.rpc({ type: 'CLEAR_CHECKPOINTS', confirm: true }), 'allRemoved')), 'danger')
    ])]);
    app.replaceChildren(e('header', { class: 'topbar' }, [e('div', { class: 'brand' }, [R.logo('brand-logo', 32), 'RepoDelta']), e('span', { class: 'version' }, [`v${R.VERSION}`])]), e('h1', {}, [t('managerTitle')]), e('p', { class: 'intro' }, [t('managerIntro')]), e('div', { class: 'grid' }, [e('aside', { class: 'side' }, [e('strong', {}, [t('tagline')]), e('p', {}, [t('localOnly')]), e('p', {}, [t('defaultOnly')]), e('p', {}, [t('themeNote')])]), e('div', {}, [e('div', { id: 'flash', 'aria-live': 'polite' }), settings, token, diagnostics, repos, backup])]), e('footer', {}, [e('span', {}, [`RepoDelta ${R.VERSION} · MIT`]), e('div', { class: 'actions' }, [R.link(t('guide'), 'help.html'), R.link(t('privacy'), 'privacy-policy.html')])]));
    renderRepos();
  }
  function renderRepos() {
    const result = document.getElementById('repo-results'); if (!result) return;
    const list = data.checkpoints.filter(cp => R.repoKey(cp.ref).includes(query.trim().toLowerCase()));
    if (!list.length) { result.replaceChildren(e('div', { class: 'empty' }, [t(data.checkpoints.length ? 'emptySearch' : 'noCheckpoints')])); return; }
    result.replaceChildren(e('ul', { class: 'repo-list' }, list.map(cp => e('li', { class: 'repo' }, [e('div', {}, [R.link(`${cp.ref.owner}/${cp.ref.repo}`, R.repoUrl(cp.ref), { class: 'repo-name', title: t('openRepo') }), e('div', { class: 'repo-meta' }, [`${cp.branch} · ${R.shortSha(cp.sha)}`]), e('div', { class: 'repo-date' }, [R.date(cp.markedAt, lang)])]), R.button(t('remove'), () => confirm(t('confirmRemove', { repo: `${cp.ref.owner}/${cp.ref.repo}` }), () => run(() => R.rpc({ type: 'UNTRACK', ref: cp.ref, revision: cp.revision }), 'removedSuccess')), 'quiet', { 'aria-label': `${t('remove')}: ${cp.ref.owner}/${cp.ref.repo}` })]))));
  }
  refresh().catch(error => { app.replaceChildren(e('h1', {}, ['RepoDelta']), e('p', { class: 'notice error' }, [R.errorText(error, lang)]), R.button(t('retry'), () => location.reload())); });
})();
