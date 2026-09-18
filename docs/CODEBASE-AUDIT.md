# RepoDelta v1.0.3 codebase audit

## Conclusion

The persistent API failure in 1.0.0-1.0.2 was caused by loss of the native `WorkerGlobalScope.fetch` receiver in `src/background/github.js`. The function was stored on `GitHubClient` and invoked as an instance method, causing Chrome to throw `Illegal invocation` before network I/O. The token, GitHub API permissions, CORS, CSP and proxy were not the direct cause of this error.

## Findings

### Critical - native fetch receiver loss

Old:

```js
constructor(store, fetcher = fetch) {
  this.fetcher = fetcher;
}
await this.fetcher(url, init);
```

Fixed:

```js
constructor(store, fetcher = globalThis.fetch) {
  this.fetcher = fetcher.bind(globalThis);
}
```

Receiver-sensitive WebIDL methods must retain a valid platform receiver. Calling the detached native function through `this.fetcher(...)` supplied the `GitHubClient` instance instead.

### High - test architecture did not exercise the native transport

Node tests and the offline browser harness injected ordinary JavaScript fetch stubs that ignore `this`. They therefore could not reproduce Chrome's receiver check. v1.0.3 adds receiver-sensitive regression tests. A real unpacked-extension + service-worker + live `api.github.com` request remains a release gate.

### Medium - compatibility retry obscured deterministic programming failures

The fallback retried any fetch exception with fewer headers. That can be useful for genuine transport issues, but it cannot repair `Illegal invocation`; it repeated the same bad call and made the problem look external. Keep diagnostics able to distinguish browser transport failures from internal invocation defects.

### Low - host-permission diagnostics were unrelated to this incident

`api.github.com` is already a required `host_permissions` origin. Chrome documents host permissions as the mechanism that enables cross-origin fetches from extension service workers. Permission diagnostics can still help if a user withheld required host access, but they did not cause this failure.

## Remaining codebase review

- The token stays in `chrome.storage.session` restricted to trusted contexts and is excluded from local backups.
- GitHub calls are restricted to the fixed `https://api.github.com` origin and a repository metadata/commit/compare allowlist.
- Content scripts cannot turn the worker into an arbitrary URL fetch proxy.
- Repository-controlled strings are rendered as DOM text, not `innerHTML`.
- Baseline revisions and authentication epochs guard stale multi-tab writes and authentication changes.
- File/commit result caps are disclosed before acknowledgement.
- `Date.now` is also stored as a function and invoked through an instance property, but it is not a receiver-sensitive WebIDL method. No other detached receiver-sensitive browser-native method was found in the current source.

## Release gates

1. Load unpacked v1.0.3 in real Chrome.
2. Confirm Settings diagnostics returns HTTP 200 for the minimal request.
3. Test a public repository without a token.
4. Add a session token and test authenticated diagnostics.
5. Test a private repository with repository-scoped Contents read permission.
6. Restart/reload Chrome and confirm the token disappears while checkpoints remain.
7. Add a commit and confirm `Delta +N`.
8. Change a checkpoint in another tab and confirm stale writes are rejected.
