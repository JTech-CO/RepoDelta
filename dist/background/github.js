/* Read-only GitHub adapter. No arbitrary URL messages, cookies, or remote code. */
(() => {
  'use strict';
  const R = globalThis.RepoDelta;

  const SAFE_API_ORIGIN = 'https://api.github.com';
  const compactError = error => {
    const name = typeof error?.name === 'string' ? error.name : 'Error';
    const message = typeof error?.message === 'string' ? error.message : String(error || 'Unknown error');
    // Browser fetch errors do not contain request headers, but keep diagnostics
    // deliberately short and strip line breaks before exposing them to the UI.
    return `${name}: ${message}`.replace(/[\r\n\t]+/g, ' ').slice(0, 220);
  };

  R.GitHubClient = class {
    constructor(store, fetcher = globalThis.fetch, now = Date.now) {
      this.store = store;
      R.assert(typeof fetcher === 'function', 'INVALID_INPUT');
      // WebIDL methods such as WorkerGlobalScope.fetch are receiver-sensitive.
      // Storing the native function and later calling it as this.fetcher(...)
      // changes its receiver to GitHubClient and Chrome throws 'Illegal invocation'.
      // Bind once to the actual service-worker global so production and injected
      // test transports share the same call shape.
      this.fetcher = fetcher.bind(globalThis);
      this.now = now;
      this.queue = R.createQueue();
      this.inflight = new Map();
      this.controllers = new Set();
    }

    cancel() {
      for (const controller of this.controllers) controller.abort();
      this.inflight.clear();
    }

    async transport(url, headers, controller, authEpoch) {
      const primary = {
        method: 'GET',
        headers,
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-cache'
      };

      try {
        return { response: await this.fetcher(url, primary), compatibilityFallback: false };
      } catch (firstError) {
        if ((await this.store.auth()).epoch !== authEpoch) R.fail('AUTH_CHANGED');
        if (firstError?.name === 'AbortError') R.fail('TIMEOUT');

        // Compatibility retry: some local proxies/security products are known
        // to object to less common request headers. Retry once without the API
        // version and conditional cache header. Authorization is retained when
        // present; GitHub explicitly permits it for CORS requests.
        const fallbackHeaders = { Accept: 'application/vnd.github+json' };
        if (headers.Authorization) fallbackHeaders.Authorization = headers.Authorization;
        try {
          return {
            response: await this.fetcher(url, {
              method: 'GET',
              headers: fallbackHeaders,
              credentials: 'omit',
              redirect: 'follow',
              signal: controller.signal
            }),
            compatibilityFallback: true
          };
        } catch (secondError) {
          if ((await this.store.auth()).epoch !== authEpoch) R.fail('AUTH_CHANGED');
          if (secondError?.name === 'AbortError') R.fail('TIMEOUT');
          R.fail('NETWORK', 0, 0, `${compactError(firstError)} | fallback: ${compactError(secondError)}`);
        }
      }
    }

    async get(path, kind, force = false) {
      R.assert(/^\/repos\/[A-Za-z0-9%-]+\/[A-Za-z0-9_.%-]+(?:\/(?:commits\?sha=[^#]+&per_page=1|compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}\?per_page=100&page=[1-5]))?$/.test(path), 'INVALID_INPUT');
      R.assert(['repo','head','compare'].includes(kind));
      const auth = await this.store.auth();
      const key = `${auth.epoch}:${kind}:${path}`;
      if (this.inflight.has(key)) return this.inflight.get(key);

      const task = this.queue(async () => {
        R.assert((await this.store.auth()).epoch === auth.epoch, 'AUTH_CHANGED');
        const cached = await this.store.cache(key);
        if (!force && cached && this.now() - cached.at < R.LIMITS.cacheMs) {
          R.assert((await this.store.auth()).epoch === auth.epoch, 'AUTH_CHANGED');
          return { data: cached.data, at: cached.at, cached: true };
        }

        const rate = await this.store.rate();
        if (rate.retryAt > this.now()) R.fail('RATE_LIMIT', 429, rate.retryAt);

        const controller = new AbortController();
        this.controllers.add(controller);
        const timer = setTimeout(() => controller.abort(), 18000);
        try {
          const headers = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': R.API_VERSION
          };
          if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
          if (cached?.etag) headers['If-None-Match'] = cached.etag;
          const url = `${SAFE_API_ORIGIN}${path}`;

          // NETWORK is now produced only by the fetch operation itself. In
          // v1.0.1, unrelated post-response errors could be mislabeled as a
          // connection failure because the whole request pipeline was caught.
          const transported = await this.transport(url, headers, controller, auth.epoch);
          const response = transported.response;

          if (response.url) {
            const finalUrl = new URL(response.url);
            R.assert(
              finalUrl.origin === SAFE_API_ORIGIN &&
              /^\/(repos\/|repositories\/\d+(\/|$))/.test(finalUrl.pathname) &&
              !finalUrl.username && !finalUrl.password,
              'UNSAFE_REDIRECT'
            );
          }

          R.assert((await this.store.auth()).epoch === auth.epoch, 'AUTH_CHANGED');
          const now = this.now();
          const remainingRaw = response.headers.get('x-ratelimit-remaining');
          const limitRaw = response.headers.get('x-ratelimit-limit');
          const resetAt = Number(response.headers.get('x-ratelimit-reset') || 0) * 1000;
          const retryHeader = response.headers.get('retry-after');
          let retryAt = retryHeader
            ? (Number.isFinite(Number(retryHeader)) ? now + Number(retryHeader) * 1000 : Date.parse(retryHeader))
            : 0;
          const remaining = remainingRaw !== null ? Number(remainingRaw) : null;
          if (remaining === 0 && resetAt > now) retryAt = Math.max(retryAt || 0, resetAt);

          if (response.status === 304 && cached) {
            await this.store.setRate({ remaining, limit: limitRaw ? Number(limitRaw) : null, resetAt, retryAt: retryAt || 0 }, auth.epoch);
            const entry = { ...cached, at: now };
            await this.store.putCache(key, entry, auth.epoch);
            R.assert((await this.store.auth()).epoch === auth.epoch, 'AUTH_CHANGED');
            return { data: entry.data, at: now, cached: true, compatibilityFallback: transported.compatibilityFallback };
          }

          let json;
          try {
            json = await response.json();
          } catch (error) {
            R.fail('BAD_RESPONSE', response.status, 0, compactError(error));
          }

          R.assert((await this.store.auth()).epoch === auth.epoch, 'AUTH_CHANGED');
          if ([403,429].includes(response.status) && (remaining === 0 || retryHeader || response.status === 429 || /rate limit|secondary rate|abuse/i.test(json?.message || ''))) {
            retryAt = Math.max(retryAt || 0, now + 60000);
            await this.store.setRate({ remaining, limit: limitRaw ? Number(limitRaw) : null, resetAt, retryAt }, auth.epoch);
            R.fail('RATE_LIMIT', response.status, retryAt);
          }

          await this.store.setRate({ remaining, limit: limitRaw ? Number(limitRaw) : null, resetAt, retryAt: retryAt || 0 }, auth.epoch);
          if (!response.ok) {
            const code = response.status === 401 ? 'TOKEN_REJECTED'
              : response.status === 403 ? 'FORBIDDEN'
              : response.status === 404 ? 'NOT_FOUND'
              : response.status === 409 ? 'CONFLICT'
              : response.status === 422 ? 'UNPROCESSABLE'
              : response.status >= 500 ? 'GITHUB_UNAVAILABLE'
              : 'API_ERROR';
            R.fail(code, response.status);
          }

          const data = kind === 'repo' ? R.normalizeRepo(json)
            : kind === 'head' ? R.normalizeCommits(json)
            : R.normalizeCompare(json);
          await this.store.putCache(key, { data, at: now, etag: response.headers.get('etag') || '' }, auth.epoch);
          R.assert((await this.store.auth()).epoch === auth.epoch, 'AUTH_CHANGED');
          return { data, at: now, cached: false, compatibilityFallback: transported.compatibilityFallback };
        } finally {
          clearTimeout(timer);
          this.controllers.delete(controller);
        }
      });

      this.inflight.set(key, task);
      try {
        return await task;
      } finally {
        if (this.inflight.get(key) === task) this.inflight.delete(key);
      }
    }

    async diagnose() {
      const auth = await this.store.auth();
      const url = `${SAFE_API_ORIGIN}/rate_limit`;
      const probe = async (label, headers) => {
        const started = this.now();
        try {
          const response = await this.fetcher(url, {
            method: 'GET',
            headers,
            credentials: 'omit',
            redirect: 'follow',
            cache: 'no-store'
          });
          let message = '';
          try {
            const body = await response.clone().json();
            if (typeof body?.message === 'string') message = body.message.slice(0, 160);
          } catch { /* status/headers are sufficient */ }
          return {
            label,
            ok: response.ok,
            status: response.status,
            finalUrl: response.url || url,
            elapsedMs: Math.max(0, this.now() - started),
            message
          };
        } catch (error) {
          return {
            label,
            ok: false,
            status: 0,
            finalUrl: '',
            elapsedMs: Math.max(0, this.now() - started),
            error: compactError(error)
          };
        }
      };

      const minimal = await probe('minimal', { Accept: 'application/vnd.github+json' });
      const versioned = minimal.ok
        ? await probe('versioned', { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': R.API_VERSION })
        : null;
      const authenticated = auth.token
        ? await probe('authenticated', { Accept: 'application/vnd.github+json', Authorization: `Bearer ${auth.token}` })
        : null;
      return { hasToken: Boolean(auth.token), minimal, versioned, authenticated };
    }
  };
})();
