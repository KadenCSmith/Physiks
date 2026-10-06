# Build a new app from the template

Start with [the AI guide](AI_START_HERE.md) and fill in [the app brief](APP_BRIEF.md) when working with a coding agent.

## Copy and brand it

Use GitHub's **Use this template** button to create your own repository. This gives the new app its own history rather than adding another app to the source projects.

Edit `src/app.config.ts` first:

- `id`: unique storage namespace, such as `wave-lab`.
- `title` and `shortTitle`: full page title and compact header name.
- `description`: the footer and page description.
- `switcherLabel`: keep “Simulation” or choose a label that fits the app.
- `documentationLabel`: the Finder's reference link.
- `defaultModelId`: an ID registered in `src/models.ts`.
- `defaultSpeed`: positive viewing-speed multiplier; 0.25 matches the existing apps.

Update the package name and README for the new repository. Set its homepage to its eventual live URL. The app version comes from `package.json`.

## Add a model

Run `npm run new:model -- wave-lab "Wave lab"` with your own unique lowercase kebab ID. It creates a module under `src/models/<id>` and a test, and prints the exact import and registration changes for `src/models.ts`. It never overwrites an existing model. Use `--dry-run` to inspect planned files. The generated linear response is a working illustrative baseline, not an implementation of your requested domain.

Replace `calculation.ts` with your equations and sampling, `model.ts` with matching controls/readouts/playback/plots, `Scene.tsx` with the visualization, `Lesson.tsx` with labeled live equations, and `formulas.ts` with grouped references and underlying steps. Keep local visual styling in `styles.css`. Update the generated test to check meaningful domain behavior. Keep equations and sampling pure, separated from pointer and drawing code.

Declare every numeric parameter in both `defaults` and `controls`. Test the initial condition, expected response, units, meaningful limits, and any conserved quantity. Return finite snapshots for the full duration selected by `getPlayback`.

Build the scene from `parameters` and `snapshot`. For a drag interaction, call `onInteractionStart`, update a declared key through `onParameterChange`, then call `onInteractionEnd` on release or cancellation. A keyboard interaction should perform the same update. Use model-specific labels and units.

The learning panel receives the same snapshot. Label fixed values separately from changing values so the substituted equation is easy to read. Include the underlying derivative steps or geometry in `formulas`, with an explanatory group and accurate source references when applicable.

Generated scenes and lessons already use the shared `useNumberFormat` hook. Keep it for displayed values so Toolbox's maximum-decimal setting applies everywhere, without trailing zeros. Use original numbers for model sampling, geometry, and editable inputs. Keep symbolic math static and show changing numeric substitutions with labeled React text.

Optional `plots` use snapshot keys. Each entry needs a readable label and unit. Optional `Details` can explain the apparatus or reduction steps without crowding the scene.

Finally, import the definition in `src/models.ts` and add it to the array. Menus, Toolbox, Finder, keyboard selection, and saved model settings update from that registration. Remove the examples once the real app is ready.

## Verify and publish

Run `npm run check:models` for targeted registry/model feedback, then `npm run check` for typechecking, lint, a generated scaffold check, all tests, and production build. Contract checks evaluate defaults, each individual control boundary, and start/middle/end times; they check numeric consistency and valid formulas, not the scientific correctness of a model. Add your own equation and conservation checks. Inspect the app at desktop and narrow widths, switch between models, edit controls, open/search Finder, pause and resume, scrub, and hide/show the tab. Check that the scene and formulas agree at the same time.

GitHub Pages is optional. Enable it with the README's Pages setting and `PUBLISH_PREVIEW` variable. The workflow follows the repository's actual name, so a new app does not retain the starter's deployment path. For another host, deploy the static `dist` directory using that host's Vite base-path requirements.

## Package a desktop app

The Tauri v2 wrapper displays the same React app through the operating system's webview. Keep models and teaching content in their existing modules; desktop packaging does not require another UI implementation.

Install Rust 1.99.0 and the [native prerequisites](https://v2.tauri.app/start/prerequisites/) for your build machine. The locked npm dependencies provide Tauri CLI 2.12.1. Run `npm run desktop:dev` to build and open the local app, `npm run desktop:pack` to create a local application, and `npm run desktop:build` to create an installer in `release/`. Review `src-tauri/tauri.conf.json` for platform defaults and `src-tauri/src/main.rs` for window/navigation behavior.

`scripts/desktop.mjs` reads identity through `desktop/identity.cjs` from generated `dist/app-metadata.json`. Change `src/app.config.ts` and `package.json`, then build again. Confirm branding, application identifier, version, icons, and saved-data isolation before release. Do not edit the generated metadata to rebrand a copy.

Use a new matching `v<package version>` tag for the four-target release workflow. It produces Mac arm64 and Intel DMGs, a Windows x64 installer, and a Linux x64 AppImage. After macOS permits startup, one Mac prompt covers installation or replacement, opening, and verified installer ejection and recoverable Trash cleanup. Routine installed launches have no setup prompts. The default build is ad-hoc signed and not notarized; your app needs its own Developer ID and notarization credentials for certificate-backed Mac distribution. See [DESKTOP.md](DESKTOP.md) for compatibility, signing secrets, testing, and publishing details. Only report downloads as available after checking the completed release and its assets.

## Prompt for future work

> Build the app described in docs/APP_BRIEF.md using this template. Read AGENTS.md and docs/AI_START_HERE.md first. Preserve the existing shell, implement the required models under src/models, and register them in src/models.ts. Include their equations and underlying steps in Finder. Verify the actual domain behavior, run npm run check, and show a browser preview before publishing within my requested scope.
