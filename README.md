# Cinematic App Framework

A working React + TypeScript starter for interactive apps with the same black canvas, thin typography, Simulation dropdown, Finder, Toolbox, and live equation layout as the Zombie Fire and Vibrations apps.

**[Use this template](https://github.com/KadenCSmith/cinematic-app-framework/generate)** · **[Open the live example](https://kadencsmith.github.io/cinematic-app-framework/)**

The reusable shell lives in `src/framework`. Two replaceable examples demonstrate a repeating oscillator and a nonrepeating relaxation model. The original projects and study materials are separate from this starter.

## Start a new app

1. Select **Use this template → Create a new repository** on GitHub.
2. Clone your new repository and run `npm ci`.
3. Edit `src/app.config.ts`: app name, unique application ID, navigation labels, starting model, and viewing speed.
4. Add your own model folder and register its definition in `src/models.ts`. Remove the example registrations when ready.
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

Keyboard: **1–9** select registered models, **Space** toggles playback, **R** restarts, and **Escape** closes a drawer or menu. Shortcuts yield to inputs and other interactive controls.

## Run and check

Node.js **22.12 or newer** is required; CI uses Node.js 24.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run preview` serves the production build at **http://127.0.0.1:5184/**. `dist/` contains the static site.

## Publish your new app

The template's checks run without hosting configuration. To enable its optional preview:

1. In the new repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. In **Settings → Secrets and variables → Actions → Variables**, add `PUBLISH_PREVIEW` with value `true`.
3. Push to `main` or run **Check and publish** manually from Actions.

The workflow builds under `/<your-repository-name>/`. It never deploys pull requests. New repositories start with publishing disabled because repository variables are not copied by GitHub templates. This repository's public example is already enabled.

## Source and scope

The shell is adapted from Kaden's [Zombie Fire Suppression Sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim) and [Vibrations Physics Sim](https://github.com/KadenCSmith/vibrations-physics-sim). See [source provenance](docs/PROVENANCE.md). No new software license has been assigned to user-owned source code.

This is a browser app starter. Backend services, accounts, analytics, and desktop installers can be added when a future app needs them.
