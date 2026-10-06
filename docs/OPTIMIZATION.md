# Desktop size measurements

Measurements below use file bytes, not Finder's allocated disk size. The app total excludes symlink duplicates. The baseline is the macOS arm64 Electron build; the baseline installer is the previously downloaded arm64 DMG.

## Pass 1: remove duplicate renderer dependencies

Vite already bundles React, KaTeX, and the icons into `dist`. The desktop main process uses Electron, Node built-ins, and local files. Electron-builder was additionally copying the full renderer packages into `app.asar`, including 23,595,164 bytes of icon-library files and 8,062,585 bytes of React DOM files.

Commit `5b097df` records this separate pass. Its `scripts/stage-desktop.mjs` prepared a runtime-only app manifest, the complete `dist` and `desktop` folders, and third-party license notices. The builder used this staging folder and explicitly excluded `node_modules`: that builder otherwise fell back to dependencies in the parent project. Pass 2 subsequently replaced this Electron packaging path.

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

## Pass 2: use the system webview

The baseline's bundled Electron frameworks accounted for 299,530,115 bytes. Version 0.3.0 replaces the wrapper with Tauri v2 and the operating system's webview. The native release uses size optimization, link-time optimization, one codegen unit, and stripped symbols. It retains both simple reference models, the complete frontend, Finder, Toolbox, math/MathML, graphs, playback, model scaffold, and all 59 font files.

| Local arm64 artifact | Baseline (bytes) | Pass 1 (bytes) | Pass 2 (bytes) |
| --- | ---: | ---: | ---: |
| Unpacked app | 338,767,257 | 301,556,949 | 4,445,406 |
| DMG | 133,849,169 | 127,518,527 | 2,605,603 |

The pass-2 DMG is 98.05% smaller than the baseline. These measurements are from a local Mac build; native CI artifacts can differ. The local DMG SHA-256 is `0c7f828c05b545348e5105b24e713f47019d9c84127148a6928cdd1c049bd301`.

Local verification: frontend typecheck/lint, generated-model validation, 93 tests, eight native tests, and a successful arm64 installer build. The updated installed app ran from `/Applications` and passed deep/strict signature verification. This remains an ad-hoc signature, not proof of notarization. Browser-downloaded Gatekeeper acceptance requires its own check and user approval when macOS requests it. Windows/Intel Mac/Linux runtime compatibility is not established by local arm64 testing.

Native UI checks covered both example models, model switching, labeled live math, Finder search, parameter edits, three-to-six-to-three decimal preference changes, and Pause preservation. The default display shows `2 kg`, `0.25×`, and at most three decimal places. The test-only relaxation target was restored and the oscillator was left playing.

The public v0.3.0 release completed all four native build jobs: Mac arm64 2,630,366 bytes, Intel Mac 2,764,582 bytes, Windows x64 2,201,352 bytes, and Linux x64 81,463,800 bytes. Linux still carries its required library ecosystem. The downloaded public arm64 DMG matched its published SHA-256 checksum. These are build/download checks; other-platform runtime opening was not tested on this Mac.

## Animation and display precision

The previous clock published only after a 33.3 ms gate and reset the gate timestamp to the current frame, skipping additional updates at some display boundaries. The new clock publishes every animation frame. A deterministic two-second 60 Hz trace improves from 42 publications to 120; this measures scheduler behavior, not native rendered FPS.

The response curve and grid no longer rebuild for cursor movement. A React regression harness running 20 cursor updates samples 241 points and performs 723 geometry reads once, versus 14,460 geometry reads before caching. Changing model parameters rebuilds the response. Navigation, hidden drawer content, and symbolic math also retain their trees between time updates. Live substitutions use labeled React text beside static symbolic math, avoiding per-frame KaTeX layout.

Toolbox saves a maximum 0–6 decimal-place preference, defaulting to three without trailing zeros. Scenes, lesson values, readouts, graph labels, time, speed, and Finder numeric summaries share the formatter. Editable physical values and calculations retain full precision. Tests cover rounding, negative zero, storage failures, app isolation, unchanged physics/geometry, and pause/seek/reset/end behavior.
