# RepoDelta architecture

[한국어](ARCHITECTURE-KR.md) · [README](../README.md)

## Scope

RepoDelta 1.0.3 is a read-only Chrome Manifest V3 extension for explicit, local checkpoints on the default branch of github.com repositories. It has no backend, GitHub mutation, telemetry, AI integration or runtime package dependency. JavaScript is split into local scripts under one `globalThis.RepoDelta` namespace. The service worker uses packaged `importScripts`; content scripts are enumerated in the manifest. Node 22 built-ins perform checking, testing, copying and ZIP packaging.

## Data flow

```text
GitHub document / toolbar popup / options page
  -> schema-checked runtime message
  -> sender policy + operation allowlist
  -> DeltaService
     -> Store (trusted local + session storage; queued writes)
     -> GitHubClient (allowlisted read-only requests)
  <- bounded, normalized snapshot or sanitized error
```

The content script never receives a token or enumerates all saved repositories. `BOOT` returns the current repository's local state without a network request. `CHECK` resolves repository metadata, the default-branch head, and, when necessary, a SHA-to-SHA comparison. Options-only operations handle tokens, backup and bulk management. Content language changes have a narrow dedicated operation. The worker validates the sender's extension ID and repository context; it is not an arbitrary-URL proxy.

## Checkpoint transaction

A record contains normalized owner/name, stable numeric repository ID, default branch, full commit SHA, checkpoint timestamps and a random internal revision. `CHECK` creates a worker-side snapshot bound to repository identity, baseline revision, displayed head SHA and authentication epoch. `MARK` accepts its snapshot ID, not a client-invented SHA. It validates the snapshot and expected baseline revision, then atomically writes the displayed head under a queued mutation. This is a local compare-and-swap operation. It never fetches a newer head while acknowledging. Concurrent tabs cannot both commit based on the same old revision. Reset requests for abnormal history require the separate reset confirmation flow.

The baseline is whole-revision state. UI filters do not mean partial acknowledgment. A confirmation explains that unexpanded or filtered rows are included in the selected revision. No checkpoint is created or advanced just by opening a page.

## Comparison states

- No checkpoint: show current head and an explicit start action.
- Empty repository: no valid head; acknowledgment is disabled.
- Same SHA / identical comparison: no unread change.
- Ahead with the expected base relationship: ordinary update.
- Behind, diverged or unexpected merge-base relationship: history-change warning.
- Different default branch: branch-change warning; no automatic migration.
- Same path, different numeric repository ID: identity-change warning.
- Metadata/head readable but comparison returns 404/409/422: comparison unavailable, without inventing its cause.
- API authentication, permission, quota, network and server failures: errors, not history changes.

Force-push cannot always be distinguished from a rebase or branch rewind; the UI reports the observed relationship rather than claiming a specific cause. Repository rename/move does not migrate checkpoints automatically. Visit the canonical URL and register the current path where needed.

## API and pagination

Only these API shapes are accepted:

```text
GET /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/commits?sha={defaultBranch}&per_page=1
GET /repos/{owner}/{repo}/compare/{baseSHA}...{headSHA}?per_page=100&page={1..5}
```

The client uses `credentials: omit`, `Accept: application/vnd.github+json` and API version `2022-11-28`. That stable version is still supported when this package was produced; GitHub's published end date is 2028-03-10. Recheck version support before a future release. Reads are serialized, in-flight duplicates are coalesced, and responses have a five-minute freshness cache plus ETag revalidation. Manual refresh bypasses freshness, not GitHub cooldown. Request timeout is 18 seconds; there is no automatic retry loop.

A comparison loads 100 commits at a time, oldest first, up to a product limit of 500. File data is retained from the first page. The API provides up to 300 files for the entire comparison, so a 300-row result is marked possibly incomplete. UI counts never imply the complete total when it is unknown. Code patches are not retained; links to full diffs go to GitHub. File URLs are built from validated identifiers and escaped path segments; deleted files use the old SHA.

Redirects never send credentials to arbitrary origins. A browser opaque redirect produces a canonical-URL guidance error instead of a speculative authenticated follow. Authentication changes abort active requests and invalidate response caches and snapshots. Epoch checks before returning or storing results prevent stale authenticated data from being reused after a token change.

## Storage and resource budgets

| Store | Contents | Retention / limits |
| --- | --- | --- |
| `storage.local` | Preferences and explicit checkpoints | Up to 1,000 checkpoints; survives browser restart |
| `storage.session` | Optional PAT + auth epoch | Session only; never exported |
| Session API cache | Normalized metadata, heads, comparisons, rate state | 5-minute freshness; 40 entries and a soft JSON size budget |
| Session snapshots | Displayed revision and baseline transaction state | 30-minute validity; at most 16 with oldest-first size pruning |
| User JSON file | Whitelisted checkpoint metadata | Explicit export; independent of browser deletion |

Both storage areas are restricted to `TRUSTED_CONTEXTS`. Local data is not an encrypted vault. Snapshot pruning retains the newest snapshot even if it exceeds its soft target; normalization, row limits and bounded strings limit the request size. Session quota/other storage failures are surfaced rather than treated as successful writes. There is no infinite storage permission. Import validates the whole file first (maximum 1 MiB and 1,000 rows), strips unexported fields and merges without overwriting an existing checkpoint. Tokens, API content and internal revisions are absent from exports.

## Presentation and page lifecycle

The content layer looks for a repository identity matching the current URL before placing its own button beside GitHub controls. A Shadow DOM element inside a list-compatible wrapper avoids invalid shadow hosts. A floating button is a last-resort placement for recognized repository pages. Soft navigation signals, a debounced MutationObserver and visibility events re-evaluate the route. A generation counter prevents old responses from appearing after navigation.

The native modal dialog handles background inertness, Escape and focus containment, with explicit focus restoration. ARIA tab semantics, arrow navigation, EN/KR strings, GitHub theme variables and narrow-viewport layouts are included. Untrusted data is rendered as text; source strings are not used as HTML. Settings are a separate extension page; the popup opens the current panel or settings. No remote font, script or image is required.

## Verification boundary

Node tests exercise core/API/service behavior with deterministic adapters. The browser harness runs the production scripts in Chromium with simulated Chrome APIs, GitHub responses and navigation. It is not native extension execution. Enterprise policy blocked unpacked installation and URL navigation in the authoring environment. See [QA](QA.md) for exact results and remaining release gates. Do not infer live GitHub compatibility from the fixture screenshots.

## Primary references

- [GitHub Compare commits](https://docs.github.com/en/rest/commits/commits#compare-two-commits)
- [GitHub REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- [Chrome extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Manifest V3 remotely hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
