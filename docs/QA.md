# RepoDelta 1.0.3 verification report

[한국어](QA-KR.md) · [README](../README.md)

**1.0.3 root-cause fix:** Chrome reported `TypeError: Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation` for both the normal and fallback requests. The native worker `fetch` function had been stored as `this.fetcher` and then invoked as an instance method, so its receiver became the `GitHubClient` object instead of the service-worker global. This defect existed unchanged in 1.0.0-1.0.2. Version 1.0.3 binds the fetch dependency to `globalThis` and adds receiver-sensitive regression tests. The source package passes 94 Node tests and 36 offline Chromium DOM checks. This environment cannot complete live GitHub API networking, so a successful unpacked-extension request remains a user-side release gate.

**1.0.1 regression fix:** A native Chrome installation of 1.0.0 reported `NETWORK` before any GitHub HTTP status, regardless of token use. 1.0.1 removes the manual-redirect transport and custom `connect-src` CSP override, and uses the same normal Chrome fetch flow (`redirect: follow`, `cache: no-cache`) already used by RepoSize/RepoView. The updated package again passes all 90 Node tests and 36 offline Chromium checks. Live GitHub API retesting is still required in the user environment.

**Status: implemented MVP with passing automated tests. Native Chrome installation and live GitHub integration remain unverified release gates.** No repository was created or pushed, and no Chrome Web Store submission was performed.

## Executed checks

| Check | Result | Actual environment |
| --- | --- | --- |
| JavaScript syntax and JSON/manifest consistency | Passed | Node 22.16.0 |
| Unit, service and API regression tests | 94 passed, 0 failed | Node built-in test runner, mocked adapters |
| Production-source browser DOM regression | 36 passed, 0 uncaught page errors | Chromium 144.0.7559.96, offline harness |
| Desktop EN, desktop KR dark, 390px KR, options layout | Rendered and visually inspected | Simulated repository/API data |

Machine-readable browser detail is in `qa-results/browser-results.json`. The package build log is included in `qa-results/package.log`. These logs describe the tests executed here, not remote CI. Exact archive integrity checks are recorded separately in `qa-results/artifact-checks.json` after packaging.

## What the tests establish

The 94 Node checks cover route/ref validation, response normalization and sensitive-field removal, translated key parity, backup validation, storage serialization, snapshot binding, exact viewed-SHA acknowledgment, stale tabs, empty repositories, slash-containing branch names, branch/identity/history warnings, comparison failures versus rate errors, commit pagination, the 500-commit cap, session-only token handling, auth invalidation, sender policy, import atomicity, ETag/304 behavior, TTL, deduplication, request headers, API allowlisting, redirects, cooldown and network error handling.

The 36 browser checks execute the actual shared/background/content/options JavaScript using a simulated Chrome adapter. They verify single-button placement, no untracked background API call, explicit initial tracking, file rows and rename search, old-version links for deletions, commit tabs, keyboard controls, language persistence in the adapter, inherited dark theme, no horizontal overflow at 390px, exact SHA confirmation despite a newer simulated HEAD, Escape/focus restoration, on-demand pagination with retained file data, 300-file disclosure, untrusted filename text rendering, warning/cancel flows, no quota retry loop, simulated navigation, floating fallback, token input clearing, token-free export and canceled bulk deletion.

## Why native extension testing is incomplete

The installed Chromium is enterprise-managed. Loading the unpacked `dist/` returned: `Loading of unpacked extensions is disabled by the administrator.` Navigation to the intended local/GitHub pages was also blocked by administrator URL policy. The policy was not changed or bypassed. Internet requests from the container were unavailable, so real GitHub API smoke tests were not executed from the extension.

The replacement UI test uses `page.set_content` and local script injection, with simulated GitHub API responses, extension messaging, storage and navigation. It establishes DOM and application behavior under those adapters, not native MV3 API behavior. QA scaffolding is isolated under `qa/` and is not included in the installation ZIP.

**Not verified:** native MV3 installation; actual service-worker startup, suspension and revival; native `chrome.storage.session` across restart/reload; live GitHub DOM selectors and SPA navigation; real public/private API authentication and organization policy; actual browser download completion; Chrome Web Store review; remote GitHub Actions; other browsers, GitHub Enterprise Server and mobile installation.

Screenshots clearly show a layout fixture and simulated data. Do not submit them as evidence that live GitHub integration has been validated. Capture real, redacted screenshots before a store release.

## Reproduce automated checks

```sh
npm run package
```

No npm dependency installation is required. Optional browser regression requires Python, Playwright and an available Chromium executable (these are QA tools only, not extension dependencies):

```sh
python tests/browser_smoke.py
```

The runner defaults to `/usr/bin/chromium`; set the `BROWSER_PATH` environment variable to the browser executable on another machine. It renders an offline harness, not the unpacked extension. For interactive simulation on an unrestricted browser:

```sh
npm run serve:qa
# Open http://127.0.0.1:5198/qa/index.html
```

## Mandatory real-browser release gate

1. Load `dist/` in a policy-unrestricted Chrome profile, verify no extension/service-worker console errors, refresh a GitHub repository and check the actual button placement in light/dark/dimmed themes.
2. Save a checkpoint on a small test repository, create changes outside the extension, then revisit. Compare file names, line counts, commit order and deletion links with GitHub's exact compare view.
3. Leave a comparison open, push one more commit externally, then acknowledge. The saved SHA must remain the one already displayed. Open two tabs and ensure a stale one cannot overwrite a newer checkpoint.
4. Test actual GitHub soft navigation, back/forward, tab switching, header replacement, and coexistence with RepoSize/RepoView and other extensions. No duplicate/flickering controls or stale repository data should remain.
5. Test anonymous public access, a scoped Contents-read token on a private test repository, invalid/expired/revoked tokens and any organization approval restrictions. Confirm cookies and bearer tokens are not leaked to non-API requests.
6. Suspend/restart the worker; reload/disable/re-enable the extension and restart Chrome. Local checkpoints must persist as applicable; session token/cache must clear on session teardown, and the UI must request fresh data.
7. Export to a real file, inspect its schema and lack of tokens, import it, preserve existing entries, and confirm delete/export cancellation. Do not use sensitive production data in screenshots.
8. Verify current API restrictions and store policies, host a public privacy policy, set a real publisher contact, capture live screenshots and review the final permission/data-use declarations. Run the packaged archive again before submission.

A passing offline test is not a waiver for any of these release gates.

## 1.0.3 root-cause audit

The persistent failure was not a token, CORS, proxy, CSP, redirect, or GitHub API problem. `GitHubClient` used `constructor(store, fetcher = fetch)` and assigned the native worker function to `this.fetcher`. Calling `this.fetcher(...)` then supplied the `GitHubClient` instance as the JavaScript receiver. Chrome's WorkerGlobalScope implementation performs a WebIDL receiver check and throws `TypeError: Illegal invocation` before network I/O. The compatibility retry invoked the same detached method, so it failed identically. Settings diagnostics used the same method and therefore repeated the same defect.

The previous Node tests injected arrow/async functions that ignore `this`, and the browser harness also injected a mock fetch rather than executing the extension service worker's native fetch. Consequently 1.0.0-1.0.2 could report green tests while the production transport was structurally broken. 1.0.3 binds the fetch function to `globalThis` and adds receiver-sensitive regression tests. Live GitHub API access remains a user-environment release gate in this restricted build environment.
