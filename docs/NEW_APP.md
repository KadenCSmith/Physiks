# Build a new app from the template

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

Copy one example into a new folder under `src`, rename its exported definition, and give it a unique model ID. Keep equations and state sampling in pure functions, separated from the scene's pointer and drawing code.

Declare every numeric parameter in both `defaults` and `controls`. Test the initial condition, expected response, units, meaningful limits, and any conserved quantity. Return finite snapshots for the full duration selected by `getPlayback`.

Build the scene from `parameters` and `snapshot`. For a drag interaction, call `onInteractionStart`, update a declared key through `onParameterChange`, then call `onInteractionEnd` on release or cancellation. A keyboard interaction should perform the same update. Use model-specific labels and units.

The learning panel receives the same snapshot. Label fixed values separately from changing values so the substituted equation is easy to read. Include the underlying derivative steps or geometry in `formulas`, with an explanatory group and accurate source references when applicable.

Optional `plots` use snapshot keys. Each entry needs a readable label and unit. Optional `Details` can explain the apparatus or reduction steps without crowding the scene.

Finally, import the definition in `src/models.ts` and add it to the array. Menus, Toolbox, Finder, keyboard selection, and saved model settings update from that registration. Remove the examples once the real app is ready.

## Verify and publish

Run the four checks in the README. Inspect the app at desktop and narrow widths, switch between models, edit controls, open/search Finder, pause and resume, scrub, and hide/show the tab. Check that the scene and formulas agree at the same time.

GitHub Pages is optional. Enable it with the README's Pages setting and `PUBLISH_PREVIEW` variable. The workflow follows the repository's actual name, so a new app does not retain the starter's deployment path. For another host, deploy the static `dist` directory using that host's Vite base-path requirements.

## Prompt for future work

> Build this app using the Cinematic App Framework in this repository. Keep the existing header, Finder, Toolbox, playback, and responsive layout. Change the branding in app.config.ts, implement the new models as SimulationDefinition modules, register them in models.ts, and include their formulas and explanatory steps in Finder. Preserve explicit Pause intent, keep calculations independent of frame rate, verify the result, and start with a browser preview.
