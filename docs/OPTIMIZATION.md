# Desktop size measurements

Measurements below use file bytes, not Finder's allocated disk size. The app total excludes symlink duplicates. The baseline is the macOS arm64 Electron build; the baseline installer is the previously downloaded arm64 DMG.

## Pass 1: remove duplicate renderer dependencies

Vite already bundles React, KaTeX, and the icons into `dist`. The desktop main process uses Electron, Node built-ins, and local files. Electron-builder was additionally copying the full renderer packages into `app.asar`, including 23,595,164 bytes of icon-library files and 8,062,585 bytes of React DOM files.

`scripts/stage-desktop.mjs` prepares a runtime-only app manifest, the complete `dist` and `desktop` folders, and third-party license notices. The builder uses this staging folder and explicitly excludes `node_modules`: this builder version otherwise falls back to dependencies in the parent project. Future Node dependencies used by the desktop main process must be deliberately included in its runtime packaging.

| Artifact | Before (bytes) | After (bytes) | Saved |
| --- | ---: | ---: | ---: |
| Unpacked arm64 app | 338,767,257 | 301,556,949 | 37,210,308 (10.98%) |
| arm64 DMG | 133,849,169 | 127,518,527 | 6,330,642 (4.73%) |
| `app.asar` | 38,921,821 | 1,711,160 | 37,210,661 (95.60%) |

Verified after rebuilding the arm64 app and DMG:

- All 65 web-build files (1,677,444 bytes) are byte-identical inside the archive, including all 59 emitted font files.
- Desktop JavaScript is byte-identical to the source runtime. The archive contains zero `node_modules` entries.
- Bundled-library license notices remain included. No model, formula, font family, semantic MathML output, or UI feature was removed.
- Packaging-script lint and deep/strict local code-signature verification passed. This is an ad-hoc signature; this check does not establish notarization, Gatekeeper acceptance, or a successful browser-download install.

The pass-1 DMG SHA-256 is `1e38cdc4b60134ec5973304cca677a248c6f425b394e0eebf7a04e63521bd1b9`. These are local build results; release-download verification is a separate check.

## Remaining footprint

Before pass 1, bundled Electron frameworks accounted for 299,530,115 bytes. Changing the desktop runtime is therefore the significant next size opportunity; it requires fresh behavior and platform verification. The web build itself is only 1,677,444 bytes. Font-format simplification could remove 816,780 bytes of WOFF/TTF alternatives while retaining WOFF2 families on supported targets, but no fonts were changed in pass 1.
