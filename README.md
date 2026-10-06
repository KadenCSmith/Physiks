# Cinematic App Framework

A working, AI-ready React + TypeScript starter for interactive apps with the same black canvas, thin typography, Simulation dropdown, Finder, Toolbox, and live equation layout as the Zombie Fire and Vibrations apps.

**[Use this template](https://github.com/KadenCSmith/Physiks/generate)** · **[Open the live example](https://kadencsmith.github.io/Physiks/)** · **[Download the app](https://github.com/KadenCSmith/Physiks/releases/latest)**

The reusable shell lives in `src/framework`. Two replaceable examples demonstrate a repeating oscillator and a nonrepeating relaxation model. The original projects and study materials are separate from this starter.

## Build with an AI agent

Give the agent [AGENTS.md](AGENTS.md), [the AI start guide](docs/AI_START_HERE.md), and your completed [app brief](docs/APP_BRIEF.md). The guide identifies which files to read and edit, how models connect to the existing UI, and what to verify. It works with any coding agent that can read the repository.

Generate a small working model, then replace its illustrative linear response with your actual requirements:

```sh
npm run new:model -- wave-lab "Wave lab"
```

This creates separate calculation, scene, lesson, formula, styling, and definition files under `src/models/wave-lab`, plus a model test. It prints the exact registration change for `src/models.ts` and refuses to overwrite existing work. Add `--dry-run` to inspect the output paths first.

Use `npm run check:models` for focused contract feedback and `npm run check` before delivery. The full check also generates, typechecks, and tests a temporary scaffold, then removes it. The checks catch nonfinite output, invalid playback windows, missing plotted quantities, invalid equations, and changes that break the starter.

## Start a new app

1. Select **Use this template → Create a new repository** on GitHub.
2. Clone your new repository and run `npm ci`.
3. Edit `src/app.config.ts`: app name, unique application ID, navigation labels, starting model, and viewing speed.
4. Generate your own model with `npm run new:model -- <id> "Title"`, implement it, and register its definition in `src/models.ts`. Remove the example registrations when ready.
5. Run `npm run dev` and open **http://127.0.0.1:5183/**.

Each model supplies its controls, initial values, deterministic state sampler, scene, learning panel, formulas, optional details, plots, and playback window. Adding a model does not require changing the shell, Finder, Toolbox, or playback controls.

See [the new-app guide](docs/NEW_APP.md) for a full checklist and [the architecture guide](docs/ARCHITECTURE.md) for the model contract.

## Included

- Configurable branding and a registry-driven Simulation dropdown.
- Toolbox with labeled sliders, numeric entries, units, validation, and reset.
- Saved display precision in Toolbox: up to three decimal places by default, adjustable from 0–6, without trailing zeros. Editable physical values and calculations retain full precision.
- Finder with model navigation, guides, live control values, grouped equations, and search across all models.
- Safe KaTeX math with semantic MathML, and a learning panel supplied by each model.
- Shared time-series plots with model-selected quantities and click-to-seek.
- Quarter-speed autoplay, explicit Pause, replay, scrubbing, and hidden-tab suspension. Edits and model switches preserve the user's playback choice.
- Animation follows display frames; graph curves and static formulas are reused between frames.
- Separate saved values for each model, isolated under the configured app ID. Stale or invalid saved values fall back to safe defaults.
- Periodic and nonperiodic playback. A finite observation window stops at its endpoint instead of jumping back to the start.
- Responsive layout, keyboard controls, labeled inputs, visible focus, and drawer focus management.
- Automated checks and optional GitHub Pages deployment that adapts to the new repository's name.
- AI instructions, an app brief, a safe model generator, and model contract checks with actionable diagnostics.
- A small Tauri v2 desktop wrapper using each operating system's webview, plus automatic GitHub release downloads for Apple Silicon Mac, Intel Mac, Windows x64, and Linux x64. The full React interface is shared with the browser; the installer does not carry a separate Chromium runtime.

Keyboard: **1–9** select registered models, **Space** toggles playback, **R** restarts, and **Escape** closes a drawer or menu. Shortcuts yield to inputs and other interactive controls.

## Run and check

Node.js **22.12 or newer** is required; CI uses Node.js 24.

```sh
npm ci
npm run dev
```

```sh
npm run check
```

`npm run preview` serves the production build at **http://127.0.0.1:5184/**. `dist/` contains the static site.

## Publish your new app

The template's checks run without hosting configuration. To enable its optional preview:

1. In the new repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. In **Settings → Secrets and variables → Actions → Variables**, add `PUBLISH_PREVIEW` with value `true`.
3. Push to `main` or run **Check and publish** manually from Actions.

The workflow builds under `/<your-repository-name>/`. It never deploys pull requests. New repositories start with publishing disabled because repository variables are not copied by GitHub templates. This repository's public example is already enabled.

## Desktop downloads

[The latest GitHub release](https://github.com/KadenCSmith/Physiks/releases/latest) contains four prebuilt installers:

| Computer | Package |
| --- | --- |
| Mac with Apple Silicon (M-series) | `mac-arm64.dmg` |
| Mac with Intel processor | `mac-x64.dmg` |
| Windows with Intel/AMD 64-bit processor | `win-x64.exe` |
| Linux with Intel/AMD 64-bit processor | `linux-x86_64.AppImage` |

Filenames include the app name and version. Each release includes SHA-256 checksums. Version 0.3.0 uses Tauri v2; macOS requires version 12 or later. Windows uses WebView2 and the installer downloads its runtime if needed. Linux packages use WebKitGTK 4.1 and are built on Ubuntu 22.04; compatibility still depends on the distribution.

On a Mac, open the DMG, then open the app inside it. After macOS allows it to start, one **Install and open** prompt covers copying to Applications, opening the installed copy, and ejecting and moving the original DMG to recoverable Trash after successful startup. Updating uses **Replace and open** in that same prompt. **Not now** leaves the app and installer unchanged. Routine installed launches have no setup prompts. Mounting a DMG alone cannot install or open an app.

The default Mac build is **ad-hoc signed, not Developer ID signed or notarized**. If macOS blocks an app you trust, first try opening it, then use **System Settings → Privacy & Security → Open Anyway**, as described in [Apple's guide](https://support.apple.com/en-us/102445). The install helper cannot approve that decision for you. Windows builds are not certificate signed. Certificate-backed Mac signing and notarization require owner-supplied repository secrets; none are included in the template.

For local desktop development, install Rust **1.99.0** and the [native build prerequisites](https://v2.tauri.app/start/prerequisites/), then run `npm run desktop:dev`. This builds and opens the bundled app. `npm run desktop:pack` creates a local application; `npm run desktop:build` creates the current platform's installer in `release/`. The locked Tauri CLI is **2.12.1**.

For a future app, edit its branding and package name/version, then push a matching `v<version>` tag. **Build desktop downloads** checks the source, builds on four native runners, and publishes the complete installer set. [The desktop guide](docs/DESKTOP.md) covers local preview, packaging, identity, and signing. The browser preview remains available.

Desktop builds automatically include native dependency credits and exact source archives for MPL dependencies, generated from the locked packages. All frontend fonts and both reference simulations remain included.

## Source and scope

The shell is adapted from Kaden's [Zombie Fire Suppression Sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim) and [Vibrations Physics Sim](https://github.com/KadenCSmith/vibrations-physics-sim). See [source provenance](docs/PROVENANCE.md). No new software license has been assigned to user-owned source code.

This template supports browser and desktop apps. Backend services, accounts, and analytics can be added when a future app needs them.
