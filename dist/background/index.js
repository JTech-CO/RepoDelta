/* Classic MV3 worker: every imported script is packaged with the extension. */
'use strict';
importScripts('../shared/core.js', 'store.js', 'github.js', 'service.js');
const R = globalThis.RepoDelta;
const store = new R.Store(chrome.storage);
const service = new R.DeltaService(store, new R.GitHubClient(store));
const baseDiagnoseApi = service.diagnoseApi.bind(service);
service.diagnoseApi = async () => ({
  ...(await baseDiagnoseApi()),
  hostPermission: await chrome.permissions.contains({ origins: ['https://api.github.com/*'] })
});

async function broadcast(type, ref) {
  const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
  await Promise.allSettled(tabs.filter(t => t.id !== undefined).map(t => chrome.tabs.sendMessage(t.id, { namespace: 'RepoDelta', type, ref })));
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.namespace !== 'RepoDelta') return false;
  R.dispatch(message, sender, service, chrome.runtime.id, () => chrome.runtime.openOptionsPage())
    .then(data => {
      respond({ ok: true, data });
      // A broadcast failure must not try to answer a message twice.
      let notification;
      if (message.type === 'SET_TOKEN') notification = broadcast('AUTH_INVALIDATED');
      else if (['SET_SETTINGS','SET_LANGUAGE'].includes(message.type)) notification = broadcast('SETTINGS_CHANGED');
      else if (['MARK','UNTRACK','IMPORT','CLEAR_CHECKPOINTS'].includes(message.type)) notification = broadcast('CHECKPOINTS_CHANGED', message.ref);
      if (notification) void notification.catch(() => {});
    }, e => respond({ ok: false, error: R.publicError(e) }));
  return true;
});
