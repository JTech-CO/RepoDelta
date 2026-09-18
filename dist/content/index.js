/* GitHub's page is only a rendering surface. All API/storage work uses the worker. */
(() => {
  'use strict';
  const R = globalThis.RepoDelta;
  if (R.contentStarted) return;
  R.contentStarted = true;
  let current = null, boot = null, snapshot = null, panel = null, host = null, button = null;
  let generation = 0, pending = false, timer = 0, lastCheck = 0, error = null;
  const key = ref => ref ? R.repoKey(ref) : '';
  function repositoryOnPage() {
    const ref = R.parseRepoUrl(location.href); if (!ref) return null;
    const meta = document.querySelector('meta[name="octolytics-dimension-repository_nwo"],meta[name="repository_nwo"]');
    if (meta) return meta.content.toLowerCase() === key(ref) ? ref : null;
    // Layout fallbacks do not make a network request. Missing markers mean no injection.
    const marker = document.querySelector('#repository-container-header [itemprop="name"] a, #repository-details-container [itemprop="name"] a');
    if (marker) return key(R.parseRepoUrl(marker.href)) === key(ref) ? ref : null;
    return null;
  }
  function label() {
    const lang = boot?.settings.language || 'en';
    if (error) return { text: 'Delta !', title: R.errorText(error, lang), tone: 'warning' };
    if (pending) return { text: 'Delta ···', title: R.t(lang, 'checkLoading'), tone: '' };
    if (snapshot?.state === 'ahead') return { text: `Delta +${snapshot.diff.totalCommits}`, title: R.t(lang, 'aheadTitle', { count: snapshot.diff.totalCommits }), tone: 'new' };
    if (snapshot?.state === 'current') return { text: 'Delta ✓', title: R.t(lang, 'upToDate'), tone: '' };
    if (snapshot && !['untracked','empty'].includes(snapshot.state)) return { text: 'Delta !', title: R.t(lang, 'attention'), tone: 'warning' };
    return { text: 'Delta', title: R.t(lang, boot?.checkpoint ? 'check' : 'start'), tone: '' };
  }
  function paint() {
    if (!button) return;
    const l = label(); button.querySelector('.rd-badge-label').textContent = l.text; button.title = l.title; button.dataset.tone = l.tone;
    button.setAttribute('aria-label', `RepoDelta: ${l.title}`); button.setAttribute('aria-expanded', String(Boolean(panel?.alive)));
  }
  function removeButton() { host?.remove(); host = null; button = null; }
  function ensureButton() {
    if (host?.isConnected) { paint(); return; }
    const stale = document.getElementById('repodelta-button-host'); stale?.remove();
    let container = document.querySelector('ul.pagehead-actions, #repository-details-container ul.pagehead-actions, #repository-container-header ul.pagehead-actions');
    if (!container) {
      const star = document.querySelector('[data-testid="star-button"], #repo-stars-counter-star, .starring-container');
      container = star?.closest('ul,ol,.pagehead-actions') || null;
    }
    if (!container) container = document.querySelector('#repository-details-container');
    host = R.el(container?.matches('ul,ol') ? 'li' : 'span', { id: 'repodelta-button-host' });
    const shadowHost = R.el('span');
    host.append(shadowHost);
    const root = shadowHost.attachShadow({ mode: 'open' });
    root.append(R.el('style', {}, [`:host{display:inline-flex;align-items:center;vertical-align:middle;${container ? 'margin-inline-start:6px' : 'position:fixed;right:20px;bottom:20px;z-index:9999'}}button{display:inline-flex;align-items:center;gap:6px;font:600 12px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border:1px solid var(--button-default-borderColor,var(--borderColor-default,#d1d9e0));border-radius:6px;padding:3px 10px;min-height:28px;white-space:nowrap;color:var(--fgColor-default,#1f2328);background:var(--button-default-bgColor-rest,var(--bgColor-muted,#f6f8fa));cursor:pointer}.rd-badge-logo{display:block;flex:0 0 16px;width:16px;height:16px;object-fit:contain}button:hover{filter:brightness(.96)}button:focus-visible{outline:2px solid var(--fgColor-accent,#0969da);outline-offset:3px}button[data-tone=new]{color:var(--fgColor-success,#1a7f37)}button[data-tone=warning]{color:var(--fgColor-attention,#9a6700)}`]));
    button = R.el('button', { type: 'button', 'aria-haspopup': 'dialog', onClick: openPanel }, [R.logo('rd-badge-logo', 16), R.el('span', { class: 'rd-badge-label' })]); root.append(button);
    (container || document.body).append(host); paint();
  }
  function openPanel() {
    if (!current) return;
    if (panel?.alive) { panel.dialog.focus(); return; }
    const ref = current; const g = generation;
    panel = new R.Panel(ref, boot?.settings.language || 'en', value => {
      if (generation !== g) return; snapshot = value; error = null; lastCheck = Date.now();
      if (boot) boot.checkpoint = value.baseline; paint();
    }, () => { if (generation !== g) return; snapshot = null; if (boot) boot.checkpoint = null; error = null; paint(); });
    panel.returnFocus = button;
    panel.onClose = () => { if (generation === g) { panel = null; paint(); } };
    panel.open().catch(() => {}); paint();
  }
  async function checkAuto() {
    if (!current || !boot?.checkpoint || !boot.settings.autoCheck || pending || panel?.alive) return;
    const g = generation, ref = current; pending = true; error = null; paint();
    try { const s = await R.rpc({ type: 'CHECK', ref }); if (g === generation) { snapshot = s; lastCheck = Date.now(); } }
    catch (e) { if (g === generation) error = e; }
    finally { if (g === generation) { pending = false; paint(); } }
  }
  async function sync() {
    const ref = repositoryOnPage();
    if (key(ref) !== key(current)) {
      generation++; const g = generation;
      panel?.destroy(); panel = null; removeButton(); current = ref; boot = null; snapshot = null; error = null; pending = false; lastCheck = 0;
      if (!ref) return;
      ensureButton();
      try { const data = await R.rpc({ type: 'BOOT', ref }); if (g !== generation) return; boot = data; paint(); checkAuto(); }
      catch (e) { if (g === generation) { error = e; paint(); } }
    } else if (current) ensureButton();
  }
  function schedule() { if (timer) return; timer = setTimeout(() => { timer = 0; sync(); }, 100); }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  for (const event of ['turbo:load','turbo:render','pjax:end','soft-nav:end','popstate','pageshow']) window.addEventListener(event, schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastCheck >= R.LIMITS.cacheMs) checkAuto(); });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.namespace !== 'RepoDelta' || sender.id !== chrome.runtime.id) return false;
    if (message.type === 'OPEN_PANEL') { sync().then(() => { openPanel(); respond({ opened: Boolean(panel) }); }); return true; }
    if (!['AUTH_INVALIDATED','SETTINGS_CHANGED','CHECKPOINTS_CHANGED'].includes(message.type) || !current) return false;
    if (message.type === 'CHECKPOINTS_CHANGED' && message.ref && key(message.ref) !== key(current)) return false;
    const g = generation, ref = current;
    if (message.type === 'AUTH_INVALIDATED') { snapshot = null; error = null; panel?.invalidate(true); }
    R.rpc({ type: 'BOOT', ref }).then(data => {
      if (generation !== g) return; boot = data;
      if (message.type === 'SETTINGS_CHANGED' && panel?.alive) { panel.lang = data.settings.language; panel.render(); }
      if (message.type === 'CHECKPOINTS_CHANGED' && (snapshot?.baseline?.revision || null) !== (data.checkpoint?.revision || null)) {
        snapshot = null; error = new R.DeltaError('STALE_CHECKPOINT'); panel?.invalidate(false);
      }
      paint();
    }).catch(() => {});
    return false;
  });
  sync();
})();
