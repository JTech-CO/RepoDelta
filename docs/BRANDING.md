# RepoDelta 1.0.4 branding

[한국어](BRANDING-KR.md) · [README](../README.md)

## Source of truth

`public/icons/logo.svg` is the canonical production artwork. It comes from the publisher's new SVG at commit `5ead41a0f8a3f5bebb4ed98aefb1b002dd1b6b88`; only `viewBox="0 0 412 412"` and a trailing newline were added. Geometry, square background, stroke proportions and #1A7F37 are unchanged. The byte-exact vector upload is retained in `docs/brand/uploaded-logo.svg`. The byte-exact PNG upload is retained in `public/icons/original.png` as a reference, not as a second generation input.

## Consumers

| Surface | Asset |
| --- | --- |
| Chrome manifest and toolbar | `icons/16.png`, `32.png`, `48.png`, `128.png` |
| GitHub badge (16px), panel (28px), options/popup (32px) | `R.logo()` resolving `icons/logo.svg` through `chrome.runtime.getURL` |
| Help/privacy header (36px), README (72px) | Relative `icons/logo.svg` / `public/icons/logo.svg` |
| Document/tab favicon | `icons/32.png?v=1.0.4` |
| Optional ICO files | Same SVG, same four output sizes |

The adjacent brand text provides the accessible name; decorative logo images use empty alt text. The page header button keeps its image node when the state label changes. No CSS mask or rounded corner treatment changes the uploaded square artwork.

Only `icons/logo.svg` is web-accessible, and only from github.com. Extension code, storage, API responses and tokens are not exposed as web-accessible resources. Image URLs are local extension resources, not developer-hosted URLs.

## Regenerate after editing the logo

Normal check/test/build/package requires Node.js 22+ only. Committed image files are sufficient; no Python or npm dependencies are needed to install or build the existing package.

Only when changing the artwork:

```sh
python -m pip install -r scripts/requirements-icons.txt
python scripts/generate-icons.py
npm run package
```

The optional generator uses CairoSVG and Pillow, reads only the local SVG and rejects external SVG resources. `scripts/icon-assets.json` records source/output SHA-256 hashes. Both `npm run check` and `npm run build` reject modified SVGs or rasters that no longer match this manifest. This is a stale-asset guard, not a security signature. Changing only the reference `original.png` has no effect; change the canonical SVG and regenerate.

Optional browser QA (Python + Playwright + locally installed Chromium):

```sh
python tests/browser_smoke.py
python tests/branding_documents.py
```

These are offline renderers of actual source/files, with simulated Chrome/GitHub data. They do not validate native MV3 installation or a deployed Pages site. See [QA](QA.md).

## Packaging and publishing

`npm run package` rebuilds `dist` and `releases/RepoDelta-v1.0.4-chrome.zip`. Update `public`, `src`, `scripts`, `dist` and documentation together, not just one SVG. Host the complete `public/` directory including `icons` and `document.css`; uploading privacy HTML alone leaves assets missing. Existing `public/privacy-policy.html` URLs remain valid. Web Store dashboard images are external to this repository and must be updated separately if already uploaded.

References: [Chrome manifest icons](https://developer.chrome.com/docs/extensions/reference/manifest/icons), [web-accessible resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources).
