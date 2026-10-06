# Architecture

The app separates reusable interface behavior from each model's calculations and teaching content.

| Location | Responsibility |
| --- | --- |
| `src/app.config.ts` | Branding, storage namespace, navigation labels, initial model, and default viewing speed |
| `src/models.ts` | Registered model definitions; their order also determines menu order and numeric keyboard shortcuts |
| `src/App.tsx` | Connects model selection, saved parameters, playback, controls, readouts, scene, plots, and learning panel |
| `src/framework/types.ts` | Shared model and component contracts |
| `src/framework/model.ts` | Registry validation, safe parameter restoration, and model ID fallback |
| `src/framework/usePlayback.ts` | Physical time, viewing speed, explicit playback intent, visibility, and endpoint behavior |
| `src/framework/CinematicUI.tsx` | Shared Finder/Toolbox drawers, portals, focus, and current-value navigation |
| `src/framework/AppChrome.tsx` | Configurable header, model menu, and Finder guides |
| `src/framework/FormulaLibrary.tsx` | Registry-driven equation grouping and search |
| `src/framework/TimeSeriesChart.tsx` | Quantity selection, plotting, and time seeking |
| `src/framework/ParameterControl.tsx` | Slider and numeric entry for a declared control |
| `src/framework/Math.tsx` | Safe mathematical rendering with accessible MathML |
| `src/framework/formatting.tsx` | Per-app display precision, shared number formatting, and Toolbox control |
| `src/framework/styles.css`, `cinematic.css` | Shared typography, layout, color, and responsive shell |
| `src/examples` | Replaceable examples, their scenes, learning panels, formulas, and local styling |
| `src/models/<id>` | App-specific models generated as small separate calculation, scene, lesson, formula, definition, and style files |
| `scripts/new-model.mjs`, `scripts/templates/model` | Dependency-free scaffold generator and editable source templates |
| `AGENTS.md`, `docs/AI_START_HERE.md`, `docs/APP_BRIEF.md` | AI workflow, edit boundaries, and app requirements |
| `src-tauri/src/main.rs` | Native Tauri window, single-instance behavior, and navigation boundaries |
| `src-tauri/src/install.rs` | macOS first-launch installation, relaunch, and optional recoverable installer cleanup |
| `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` | Native bundle defaults, permissions, and Rust dependencies |
| `desktop/identity.cjs`, `desktop/build-config.mjs`, `scripts/desktop.mjs` | Metadata-derived desktop identity, native build configuration/orchestration, and normalized release files |
| `.github/workflows/release.yml` | Four-target build, optional owner-configured signing, and complete release publication |

## Model contract

A `SimulationDefinition` is a complete module. Use `defineSimulation` to validate it, then add it to the `models` array.

- `id`, `title`, and `description` identify the model. IDs are unique lowercase kebab names.
- `defaults` and `controls` declare the same set of numeric parameters. Each control states its bounds, step, label, unit, and optional note.
- `sample(parameters, time)` returns a numeric snapshot. It should be deterministic, finite within the declared playback window, and independent of rendering frames.
- `getPlayback(parameters)` declares a positive finite duration, whether it repeats, and optional disabled/note fields. Nonperiodic trajectories use `loop: false`.
- `Scene` renders from the same parameters and snapshot as the learning panel. Its callbacks update parameters and bracket dragging so playback can temporarily hold without changing Pause intent.
- `Lesson` renders live equations and learning content. `Details` optionally adds a “more info” area beneath the live readouts.
- `getReadouts` selects the labeled values visible below the scene.
- `plots` optionally selects snapshot keys, labels, units, and colors for the shared graph.
- `formulas` and optional `guides` supply the Finder content. Each formula includes a group, title, explanation, and TeX equations; usage and source references are optional.

Numbers and units belong to the model. The framework does not assume position, mass, gravity, or any particular differential equation. The relaxation example demonstrates a model with different parameters and a different snapshot from the oscillator.

## Time and state

Physical values are separate from display options and viewing speed. The clock selects a time; the model evaluates that time; every visual reads the resulting snapshot. A numerical model can use a cached trajectory behind `sample` while keeping the same interface.

Pause is a user choice. Editing a value, restoring defaults, switching models, or seeking resets/selects time without silently changing that choice. Hidden tabs suspend rendering and continue when visible. Dragging temporarily suspends the clock. At a nonrepeating endpoint, the view holds; Replay explicitly starts it again.

Parameters are stored under `<appConfig.id>:parameters:v1`, with a separate record per model. Give each new app a unique ID. Restoration ignores unknown models and keys, defaults invalid/nonfinite values, and clamps finite values to declared bounds without rounding them. Unavailable storage does not prevent the app from working.

Displayed numbers use `useNumberFormat().format(value)`. Toolbox selects a maximum of 0–6 decimal places, defaulting to three without padding trailing zeros, saved separately under `<appConfig.id>:display:v1`. This rounds text only; numeric controls, model sampling, and scene geometry retain the underlying values. Generated scenes and lessons use this shared formatter. Never feed formatted text back into the model.

The clock publishes once per animation frame using elapsed time. Graph sampling and curve geometry depend on model parameters and duration, not the moving cursor. Navigation, hidden drawer contents, and symbolic math retain their rendered trees across time changes. Live numeric substitutions use labeled React text beside static symbolic equations so KaTeX does not rebuild on every frame.

## Browser and desktop

Vite builds the same React code for both destinations. Tauri v2 embeds the built frontend and uses WKWebView on macOS, WebView2 on Windows, and WebKitGTK on Linux. It does not bundle Chromium or a Node.js runtime. Domain calculations, scenes, lessons, Finder, Toolbox, plots, and playback remain in the shared frontend. Native code provides window management, constrained external-link opening, and the Mac install flow. Test interaction and rendering in the actual native webview as well as the browser.

The generated `dist/app-metadata.json` carries the configured app identity and package version. `desktop/identity.cjs` normalizes the installer identity, and `scripts/desktop.mjs` derives Tauri overrides and publishes local build outputs into `release/`. Keep this single branding path when making a new app.

Browser and desktop storage have separate origins. The Tauri desktop origin also differs from the Electron wrapper used in version 0.2; that version's saved local settings are not automatically migrated. The new app starts with its defaults and then persists its own settings normally.

The Mac installation helper is native code, not a webpage permission. It runs after macOS permits launch, requests installation consent, copies the app with `ditto`, and relaunches the installed copy. Optional installer cleanup uses the recoverable Trash and ejects the mounted image. It does not grant Gatekeeper approval or disable operating-system security. See [DESKTOP.md](DESKTOP.md) for signing and platform details.

## Extending the starter

Change branding in the configuration and generate domain-specific modules under `src/models/<id>`. The generator prints registration instructions without rewriting the registry. A scene can use SVG, canvas, WebGL, or normal React elements. The framework does not require a particular renderer. Use local styling for domain visuals while preserving the shell's layout and keyboard access.

`validateAppConfig` checks the app ID, default model, and viewing speed. `validateModelSamples` checks defaults and each individual parameter boundary at the start, midpoint, and endpoint. It reports the model, case, quantity, and time for invalid state, nondeterministic/mutating sampling, bad playback, or missing plotted quantities. A TeX validation callback supports strict equation checks without adding a math renderer to the validation module. These checks do not prove domain equations or all combinations of parameter values; keep domain tests beside them.

If a project later needs richer parameter types or state, extend the explicit type contract and its tests together. The initial starter deliberately supports numeric parameters and snapshots, keeping the common simulation path small and clear.
