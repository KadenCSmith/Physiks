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
| `src/framework/styles.css`, `cinematic.css` | Shared typography, layout, color, and responsive shell |
| `src/examples` | Replaceable examples, their scenes, learning panels, formulas, and local styling |

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

## Extending the starter

Change branding in the configuration and add domain-specific modules beside the examples. A scene can use SVG, canvas, WebGL, or normal React elements. The framework does not require a particular renderer. Use local styling for domain visuals while preserving the shell's layout and keyboard access.

If a project later needs richer parameter types or state, extend the explicit type contract and its tests together. The initial starter deliberately supports numeric parameters and snapshots, keeping the common simulation path small and clear.
