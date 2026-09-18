# Changelog

## 1.0.3

- Fix the persistent Chrome service-worker transport failure: the native `WorkerGlobalScope.fetch` function was stored on `GitHubClient` and invoked as `this.fetcher(...)`, changing its receiver and causing `TypeError: Illegal invocation` before any HTTP request.
- Bind the fetch dependency to `globalThis` at construction so GitHub API requests and Settings diagnostics use the actual service-worker receiver.
- Add regression tests with a receiver-sensitive WorkerGlobalScope-style fetch stub; these tests fail on 1.0.0-1.0.2 and pass on 1.0.3.
- Re-audit every browser-native method stored or passed through the codebase; no other receiver-sensitive method is currently detached.
- Record the previous QA blind spot: unit and offline UI tests injected ordinary JavaScript fetch stubs, so they could not reproduce WebIDL receiver checks in Chrome.


## 1.0.2

- Restrict `NETWORK` classification to actual fetch failures instead of swallowing post-response processing errors.
- Retry one failed GitHub API fetch once with a minimal compatibility header set.
- Add Settings > GitHub API diagnostics: host-permission status, minimal request, API-version request, and optional authenticated request.
- Add a user-gesture host-access repair button for `api.github.com` when Chrome has withheld the required origin.
- Preserve a short browser error detail (for example `TypeError: Failed to fetch`) without exposing token values.

## 1.0.1

- Fixed GitHub API requests that could be surfaced as a generic network/firewall error in Chrome by replacing the manual redirect transport with Chrome's normal redirect flow.
- Removed the custom `connect-src` extension CSP override and rely on Manifest V3's default extension CSP plus the existing GitHub-only host permissions.
- Kept final-response validation so redirected API requests must still resolve to `api.github.com` on an allowed repository endpoint.
- Switched request cache mode from `no-store` to `no-cache` so ETag revalidation remains compatible with the browser transport.

[한국어](CHANGELOG-KR.md)

## 1.0.0 - 2026-09-16

Initial implementation: explicit default-branch checkpoints, pinned SHA comparisons, file filters, paginated commits, branch/history/identity warnings, multi-tab revision guards, local checkpoint manager, backup merge import/export, session-only tokens, EN/KR, light/dark theme integration, popup, help and privacy pages, dependency-free build/ZIP tooling, Node regression tests, and an offline browser QA harness.

No browser visit auto-acknowledges a revision. No GitHub data is written. Native extension installation, live API integration, enterprise-browser support, and Chrome Web Store review remain separate release gates, not completed claims.