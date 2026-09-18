# RepoDelta 1.0.4 verification

[한국어](QA-KR.md) · [README](../README.md) · [Branding](BRANDING.md)

Scope: unify the publisher's new icon, keep application logic intact and verify packaged assets. Baseline: `JTech-CO/RepoDelta` commit `5ead41a0f8a3f5bebb4ed98aefb1b002dd1b6b88`. Seven baseline directory Git tree hashes were verified before editing; the new original artwork was fetched through the connector.

## Executed checks

| Check | Result |
| --- | --- |
| Node unit/API/service/branding tests | 107 passed, 0 failed |
| Offline application DOM checks | 46 passed, 0 page errors |
| Offline document and PNG/ICO checks | 50 passed, 0 page errors, 0 missing assets |
| Artwork | Source SVG geometry and original PNG preserved; derived hash/dimension checks passed |
| Final package | See `qa-results/artifact-checks.json` |

Environment: Node 22.16.0, Chromium 144.0.7559.96. Current evidence is in `qa-results`; previous evidence is archived under `docs/qa-history/1.0.3` and is not a current pass claim.

The actual app source is rendered with mocked Chrome/GitHub adapters. The new images are decoded from actual packaged files, not substituted drawings. Checks cover branding dimensions, stable header image across state updates and the existing app regression suite. Actual public/dist help and privacy documents are rendered with their CSS and image bytes in light desktop and dark 390px layouts. All four PNG and ICO sizes are decoded by Chromium. These checks do not validate an external deployment.

## Behavior preserved

All `src/background` files are byte-identical to the baseline. `src/shared/core.js` changes only the version string. Token/session/checkpoint/API logic and existing host/API permissions are unchanged. The only new web-accessible resource is `icons/logo.svg`, scoped to github.com.

## Limits

A standard unpacked Chromium launch was attempted; no extension service worker registered in the six-second observation window. No security or management policies were modified. Native installation, the toolbar, live GitHub page resource access, session lifecycle, actual GitHub API authentication, Web Store approval and deployed GitHub Pages are not certified.

No repository push, Pages deployment or Web Store update was performed. The connector reports no push permission. Use the delivered source and Chrome ZIP, then verify the deployed/installed surfaces in your environment.

## Reproduce

```sh
npm run package
python tests/browser_smoke.py
python tests/branding_documents.py
```

Only the optional browser scripts require Python, Playwright and a local Chromium. Normal build/package requires Node.js only.
