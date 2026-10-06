# Cinematic app framework

- Keep reusable code in `src/framework`; keep application branding in `src/app.config.ts`, model registration in `src/models.ts`, and replaceable examples in `src/examples`.
- New models implement `SimulationDefinition`. Navigation, controls, Finder, readouts, and playback should come from that registry rather than hard-coded example names.
- Models sample reproducible state from parameters and time. Keep playback speed and display options separate from the model's physical values.
- Preserve explicit Play/Pause intent when changing models, editing values, seeking, or opening drawers. Pause rendering while the document is hidden. Do not loop a nonperiodic model.
- Store each model's parameters under the configured application ID. Handle unavailable storage, stale model IDs, changed controls, and nonfinite values gracefully.
- Preserve keyboard navigation, visible focus, drawer focus management, labels, and semantic math.
- Keep the source projects untouched. Do not import their lesson photos or source documents into this template.
- Do not add a software license for user-owned code unless the user requests it. Preserve source provenance.
- This is a browser-first starter. Do not add desktop packaging, accounts, analytics, or backend services unless requested.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; inspect the browser preview before publishing.
