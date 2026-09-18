# Chrome Web Store submission draft

[한국어](STORE-LISTING-KR.md) · [README](../README.md)

This is listing copy and a submission checklist, not a published listing or evidence of approval. Native installation and live GitHub verification are open gates in [QA](QA.md).

## Name

RepoDelta

## Short description

See what changed in a GitHub repository since your last explicit checkpoint. Local, read-only, and built for focused review.

## Detailed description

Start where you left off. RepoDelta adds a small Delta button to GitHub repository pages and compares the default branch with the exact commit you last marked as reviewed.

Save your first checkpoint, revisit later, and review the intervening commits and file changes without reconstructing where you stopped. Opening a page never marks changes as read. When you acknowledge a comparison, RepoDelta records the revision already displayed, not a new commit that arrived while you were reading.

Features:
- Explicit, local checkpoints for the default branch.
- Commit and file views with change status, renamed paths, line counts and filters.
- Version-pinned links and a link to the exact comparison on GitHub.
- Clear warnings for changed branches, rewritten history and unavailable comparisons.
- Protection against stale tabs overwriting a more recent checkpoint.
- English/Korean UI, GitHub theme integration and keyboard-accessible controls.
- Local JSON checkpoint backup and an optional session-only GitHub token.

Public repositories use GitHub's unauthenticated API allowance. For private repositories, provide a fine-grained token limited to the needed repositories with Contents read permission. The token is kept only for the browser extension session and is never included in backups.

RepoDelta does not write to GitHub, sell data, run analytics or contact a publisher backend. It does contact GitHub to retrieve the requested repository data. It is an independent extension, not an official GitHub or Google product.

Scope: the default branch only, not per-file read status. Up to 500 commit rows per comparison; GitHub may limit file listings to 300, with an explicit disclosure. No scheduled polling, browser-closed monitoring or inline full-code diff viewer. Checkpoints are local to this browser and previous visits cannot be recovered.

## Permission justification

| Permission | User-facing purpose |
| --- | --- |
| `storage` | Save checkpoint/preferences and keep temporary token/API cache in session storage |
| `https://github.com/*` | Identify the current repository and display the button/dialog on GitHub |
| `https://api.github.com/*` | Read repository metadata, default-branch heads and comparisons |

Single purpose: review the default-branch changes since an explicitly acknowledged repository revision. No remote executable code, external backend, all-sites host permission, browser-history access, cookies, ads, telemetry or GitHub writes are included.

## Data-use disclosure notes

Do not blindly answer every data category with "not collected". The extension processes repository identity and URL on GitHub, commit metadata and file paths, and an optional authentication token, even though these do not go to a publisher server. Apply the current Web Store questionnaire definitions to the actual data flow. The token is authentication information and private repo names may be sensitive. No behavior analysis, resale or unrelated use is performed. Explain GitHub API transfer and local/session storage consistently in the privacy policy and store form.

## Before submission

- Complete every native/live check in [QA](QA.md).
- Verify the final Chrome ZIP has `manifest.json` at its root and loads without errors.
- Host the provided `public/privacy-policy.html` and its CSS/icons at a real, public HTTPS URL. Prefer that published policy on a stable project site. The file in this archive is not already hosted.
- Supply a monitored publisher support/contact route; verify the profile link and replace it with an appropriate support page if needed.
- Capture actual GitHub screenshots with no tokens or private data. Included fixture images are QA material, not live-integration evidence.
- Check extension name availability, description limits, current permission/data-use policy, minimum browser behavior, and browser-store presentation.
- Upload the installation ZIP, not the source ZIP. Keep development fixtures, tests and source-only docs out of the submitted archive.
- Confirm the store-provided installation URL only after approval. This package intentionally does not invent one.

References: [Developer program policies](https://developer.chrome.com/docs/webstore/program-policies) · [User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) · [MV3 remote code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).
