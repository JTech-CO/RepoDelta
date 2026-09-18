(async () => {
  'use strict';
  const R = globalThis.RepoDelta, e = R.el, app = document.getElementById('app');
  try {
    const info = await R.rpc({ type: 'OPTIONS' }); const lang = info.settings.language; document.documentElement.lang = lang;
    const t = key => R.t(lang, key);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); const ref = R.parseRepoUrl(tab?.url || '');
    const cp = ref ? info.checkpoints.find(c => R.repoKey(c.ref) === R.repoKey(ref)) : null;
    const note = e('p', { class: 'muted', 'aria-live': 'polite' });
    const open = async () => {
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { namespace: 'RepoDelta', type: 'OPEN_PANEL' });
        if (!result?.opened) { note.textContent = t('noCurrentRepo'); return; } window.close();
      } catch { note.textContent = t('reloadPage'); }
    };
    app.append(e('header', { class: 'topbar' }, [e('div', { class: 'brand' }, [R.logo('brand-logo', 32), 'RepoDelta']), e('span', { class: 'version' }, [`v${R.VERSION}`])]), e('p', { class: 'intro' }, [t('popupIntro')]), e('div', { class: 'repo-box' }, ref ? [e('strong', {}, [`${ref.owner}/${ref.repo}`]), e('p', {}, [cp ? `${cp.branch} · ${R.shortSha(cp.sha)} · ${t('tracked')}` : t('notTracked')])] : [t('noCurrentRepo')]), e('div', { class: 'stack' }, [ref ? R.button(t('openPanel'), open, 'primary') : null, R.button(t('openOptions'), () => chrome.runtime.openOptionsPage())]), note, e('footer', {}, [t('localOnly')]));
  } catch (error) { app.append(e('p', {}, [R.errorText(error, 'en')])); }
})();
