# App brief

Fill this with facts from the user's request. Replace bracketed placeholders only when known; use “not needed” where appropriate. This is a working brief, not a prerequisite form. Record justified assumptions and continue work that does not depend on missing answers.

## Purpose and scope

- App name / unique app ID: [to determine]
- Intended user and task: [to determine]
- What the user should understand or accomplish: [to determine]
- Requested deliverable: [local preview, repository, deployment, or other stated result]
- In scope: [requested behavior]
- Out of scope: [explicit exclusions]
- Interface changes requested: [none stated; retain the existing cinematic shell unless requested]
- Acceptance example: [a concrete user action and the expected visible result]

## Models

Repeat this block for each model.

### [Model title / kebab-id]

- Purpose: [what this model represents]
- Governing equation or rule: [source-backed or explicitly derived equation]
- State and coordinate/sign conventions: [definitions]
- Initial conditions: [definitions and values, if specified]
- Assumptions and validity limits: [linearization, boundary conditions, supported domain, etc.]
- Undefined/singular cases and intended handling: [to determine]
- Playback: [periodic or nonperiodic; justified duration/window; endpoint behavior]
- Interaction: [what dragging/keyboard/control changes mean]
- Readouts and plotted quantities: [snapshot keys, labels, units]
- Essential learning content: [equations, substitutions, derivation steps]

| Parameter key | Meaning / symbol | Unit | Default | Min | Max | Step | Source or rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [key] | [meaning] | [unit or dimensionless] | [known value] | [limit] | [limit] | [increment] | [reference or stated assumption] |

| Snapshot key | Meaning | Unit | Calculation or relationship |
| --- | --- | --- | --- |
| [key] | [definition] | [unit] | [equation] |

## References and decisions

| Reference | Exact location | Facts used | Ambiguity / correction / assumption |
| --- | --- | --- | --- |
| [file or URL] | [page, figure, section, or timestamp] | [equation, geometry, data] | [explicitly stated; do not invent] |

- Source material authorized for inclusion in the app/repository: [to determine from the user's scope]
- Derived additions and their rationale: [to determine]
- Open questions that block a correct result: [none identified, or list]
- Decisions that can proceed without more input: [reasonable assumptions, if needed]

## Desktop distribution, when requested

- Target platforms: [macOS arm64 and x64, Windows x64, Linux x64, or the requested subset]
- Package name / version: [to determine; release tag must match `v<package version>`]
- App title / unique app ID: [defaults from `src/app.config.ts`; record intended identity]
- Installer product metadata overrides: [none needed, or exact overrides in `electron-builder.config.cjs`]
- Icons: [owner-provided assets and paths, or existing defaults retained]
- Release repository / tag: [to determine from the requested delivery]
- Signing / notarization: [owner-supplied identity and configured secret names, or not configured; never paste secret values]
- Platforms available for manual testing: [to determine; distinguish build success from opening/testing]
- Distribution limitations to communicate: [actual unsigned/unnotarized or untested status, if applicable]

## Acceptance and evidence

| Check | Expected result | Evidence after implementation |
| --- | --- | --- |
| Initial state / representative calculation | [independently expected values with tolerance] | [not yet checked] |
| Parameter limits and special cases | [defined behavior; finite supported samples] | [not yet checked] |
| Scene, readouts, equations, plots | [consistent geometry, signs, units, and time] | [not yet checked] |
| Interaction and playback | [required actions; Pause intent preserved] | [not yet checked] |
| Finder, Toolbox, keyboard, narrow layout | [usable and readable] | [not yet checked] |
| Automated checks | [`npm run check` passes] | [not yet run] |
| Desktop app, if requested | [builds; correct window title/branding; packaged controls and playback work] | [not yet built/opened] |
| Release downloads, if requested | [requested platform assets attached; actual signing status documented] | [not yet released/verified] |

- Remaining limitations to communicate: [none established yet]
- Final requested delivery location: [to determine]
