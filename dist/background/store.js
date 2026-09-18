/* All durable writes go through one queue. Tokens never enter storage.local. */
(() => {
  'use strict';
  const R = globalThis.RepoDelta;
  R.Store = class {
    constructor(storage, now = Date.now) {
      this.storage = storage; this.now = now;
      this.localQueue = R.createQueue(); this.sessionQueue = R.createQueue();
      this.ready = Promise.all([
        storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
        storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
      ]).then(() => this.sessionQueue(async () => {
        const x = await storage.session.get('rd.auth');
        if (!x['rd.auth']) await storage.session.set({ 'rd.auth': { token: '', epoch: crypto.randomUUID() } });
      }));
    }
    async settings() { await this.ready; const x = await this.storage.local.get('rd.settings'); return R.cleanSettings(x['rd.settings']); }
    async setSettings(value) { await this.ready; const settings = R.cleanSettings(value); await this.localQueue(() => this.storage.local.set({ 'rd.settings': settings })); return settings; }
    async checkpoints() { await this.ready; return (await this.storage.local.get('rd.checkpoints'))['rd.checkpoints'] || {}; }
    async checkpoint(ref) { return (await this.checkpoints())[R.repoKey(ref)] || null; }
    async mutateCheckpoints(fn) {
      await this.ready;
      return this.localQueue(async () => {
        const records = await this.checkpoints(); const result = fn(records);
        R.assert(Object.keys(records).length <= R.LIMITS.checkpoints, 'TRACKING_LIMIT');
        await this.storage.local.set({ 'rd.checkpoints': records }); return result;
      });
    }
    async auth() { await this.ready; return (await this.storage.session.get('rd.auth'))['rd.auth']; }
    async setToken(token) {
      await this.ready;
      return this.sessionQueue(async () => {
        const auth = { token, epoch: crypto.randomUUID() };
        await this.storage.session.set({ 'rd.auth': auth, 'rd.cache': {}, 'rd.snapshots': {}, 'rd.rate': {} });
        return { hasToken: Boolean(token) };
      });
    }
    async rate() { await this.ready; return (await this.storage.session.get('rd.rate'))['rd.rate'] || {}; }
    async setRate(rate, epoch) {
      await this.ready;
      return this.sessionQueue(async () => { if ((await this.auth()).epoch === epoch) await this.storage.session.set({ 'rd.rate': rate }); });
    }
    async cache(key) { await this.ready; return (await this.storage.session.get('rd.cache'))['rd.cache']?.[key] || null; }
    async putCache(key, value, epoch) {
      await this.ready;
      return this.sessionQueue(async () => {
        if ((await this.auth()).epoch !== epoch) return;
        const cache = (await this.storage.session.get('rd.cache'))['rd.cache'] || {};
        cache[key] = value;
        let keys = Object.keys(cache).sort((a,b) => cache[a].at - cache[b].at);
        while (keys.length > 40 || JSON.stringify(cache).length > 1800000) { const k = keys.shift(); if (!k) break; delete cache[k]; }
        await this.storage.session.set({ 'rd.cache': cache });
      });
    }
    async clearCache() { await this.ready; return this.sessionQueue(() => this.storage.session.set({ 'rd.cache': {} })); }
    async saveSnapshot(snapshot) {
      await this.ready;
      return this.sessionQueue(async () => {
        R.assert((await this.auth()).epoch === snapshot.epoch, 'AUTH_CHANGED');
        const snaps = (await this.storage.session.get('rd.snapshots'))['rd.snapshots'] || {};
        for (const [key, s] of Object.entries(snaps)) if (this.now() - s.createdAt > R.LIMITS.snapshotMs) delete snaps[key];
        snaps[snapshot.id] = snapshot;
        const ordered = Object.values(snaps).sort((a,b) => a.createdAt - b.createdAt);
        // Keep session storage well below its quota, even with large comparisons.
        while (ordered.length > 1 && (ordered.length > 16 || JSON.stringify(snaps).length > 1800000)) { const s = ordered.shift(); if (!s) break; delete snaps[s.id]; }
        await this.storage.session.set({ 'rd.snapshots': snaps });
        return snapshot;
      });
    }
    async snapshot(id) {
      await this.ready; R.assert(typeof id === 'string' && id.length <= 50);
      const s = (await this.storage.session.get('rd.snapshots'))['rd.snapshots']?.[id];
      R.assert(s && this.now() - s.createdAt <= R.LIMITS.snapshotMs, 'SNAPSHOT_EXPIRED');
      R.assert(s.epoch === (await this.auth()).epoch, 'AUTH_CHANGED'); return s;
    }
  };
})();
