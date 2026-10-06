# Cinematic App Framework

A working, AI-ready React + TypeScript starter for interactive apps with the same black canvas, thin typography, Simulation dropdown, Finder, Toolbox, and live equation layout as the Zombie Fire and Vibrations apps.

**[Use this template](https://github.com/KadenCSmith/cinematic-app-framework/generate)** · **[Open the live example](https://kadencsmith.github.io/cinematic-app-framework/)** · **[Download the app](https://github.com/KadenCSmith/cinematic-app-framework/releases/latest)**

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
- Finder with model navigation, guides, live control values, grouped equations, and search across all models.
- Safe KaTeX math with semantic MathML, and a learning panel supplied by each model.
- Shared time-series plots with model-selected quantities and click-to-seek.
- Quarter-speed autoplay, explicit Pause, replay, scrubbing, and hidden-tab suspension. Edits and model switches preserve the user's playback choice.
- Separate saved values for each model, isolated under the configured app ID. Stale or invalid saved values fall back to safe defaults.
- Periodic and nonperiodic playback. A finite observation window stops at its endpoint instead of jumping back to the start.
- Responsive layout, keyboard controls, labeled inputs, visible focus, and drawer focus management.
- Automated checks and optional GitHub Pages deployment that adapts to the new repository's name.
- AI instructions, an app brief, a safe model generator, and model contract checks with actionable diagnostics.
- An Electron desktop wrapper and automatic GitHub release downloads for Apple Silicon Mac, Intel Mac, Windows x64, and Linux x64.

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

[The latest GitHub release](https://github.com/KadenCSmith/cinematic-app-framework/releases/latest) contains four prebuilt installers:

| Computer | Package |
| --- | --- |
| Mac with Apple Silicon (M-series) | `mac-arm64.dmg` |
| Mac with Intel processor | `mac-x64.dmg` |
| Windows with Intel/AMD 64-bit processor | `win-x64.exe` |
| Linux with Intel/AMD 64-bit processor | `linux-x64.AppImage` |

Filenames include the app name and version. Each release includes SHA-256 checksums. Mac builds are ad-hoc signed, not Developer ID signed or notarized; Windows builds are not certificate signed, so operating systems may require a trust decision before opening them.

For a future app, edit its branding and package name/version, then push a matching `v<version>` tag. **Build desktop downloads** checks the source, builds on four native runners, and publishes the complete installer set. [The desktop guide](docs/DESKTOP.md) covers local preview, packaging, identity, and signing. The browser preview remains available.

## Source and scope

The shell is adapted from Kaden's [Zombie Fire Suppression Sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim) and [Vibrations Physics Sim](https://github.com/KadenCSmith/vibrations-physics-sim). See [source provenance](docs/PROVENANCE.md). No new software license has been assigned to user-owned source code.

This template supports browser and desktop apps. Backend services, accounts, and analytics can be added when a future app needs them.
