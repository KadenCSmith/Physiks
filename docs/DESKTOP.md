# Desktop builds and releases

The Electron wrapper opens the same built app used by the browser. It loads bundled local files; a separate development server is not required.

## Download targets

Open this repository’s **Releases** page and choose the asset for your operating system and processor.

| System | Processor | Package |
| --- | --- | --- |
| macOS | Apple silicon · arm64 | `.dmg` |
| macOS | Intel · x64 | `.dmg` |
| Windows | x64 | `.exe` installer |
| Linux | x64 | `.AppImage` |

These are separate build targets, not one universal package. Other architectures are not part of the release matrix. Test the packaged app on the operating-system versions you intend to support; producing an artifact does not establish compatibility with every version or Linux distribution.

The initial desktop release is **0.2.0**. Its signing configuration is:

- **macOS:** ad-hoc signed (`identity: '-'`) with hardened runtime enabled. These apps are **not Developer ID signed or notarized** (`notarize: false`).
- **Windows:** not certificate signed (`signExecutable: false`).

No signing certificates were supplied. Operating-system trust prompts may appear. A future app needs its own credentials and configuration for certificate-backed signing and macOS notarization; hardened runtime alone does not provide either.

## Brand a new app

Before packaging a copy of the template:

1. Set a unique `id` and the desired `title` in [`src/app.config.ts`](../src/app.config.ts). The ID isolates saved application data.
2. Update the package `name`, `version`, and `description` in [`package.json`](../package.json), and keep `package-lock.json` in sync. The release tag must match this version.
3. Build once and inspect `dist/app-metadata.json`. It is generated from the actual app configuration and package metadata; do not edit it by hand.
4. Review the derived desktop identity and packaging settings. The product name removes filesystem-invalid punctuation, while the in-app title remains the configured title. Give the new app appropriate icons before distributing it as a finished product.
5. Run the app checks, inspect the desktop app, and build a local package. Verify the title, saved-data isolation, controls, Finder, playback, and packaged launch before tagging a release.

[`desktop/identity.cjs`](../desktop/identity.cjs) exports `readDesktopIdentity(distDir)`, which reads the built metadata. It derives `productName` from the app title, `appId` and `storageName` as `app.cinematic.<app id>`, `executableName` from the normalized package name, and `version` from the built package version. The Electron wrapper uses `storageName` for its application-data folder. [`electron-builder.config.cjs`](../electron-builder.config.cjs) uses that identity for packaging, so a copied app does not require a second manually maintained branding object.

## Build locally

Use the Node version required by `package.json`, then install the locked dependencies:

```sh
npm ci
npm run check
npm run desktop:dev
```

`desktop:dev` builds the web app and opens it in Electron. It is a built-app preview, not a hot-reloading development server. Use `npm run dev` for the browser development loop.

```sh
npm run desktop:build
npm run desktop:pack
```

`desktop:build` builds the app and creates the configured package for the current platform. `desktop:pack` produces an unpacked application for local inspection. Output goes into the ignored `release/` directory. The automated workflow handles the full platform and architecture matrix; a local build does not produce all four download targets.

The desktop entry point is [`desktop/main.cjs`](../desktop/main.cjs). Keep domain calculations and model UI in their existing modules; the wrapper should only provide desktop window and application behavior.

## Publish versioned downloads

[`release.yml`](../.github/workflows/release.yml) runs when a version tag is pushed. Commit the application and matching package/lockfile version before creating the tag. For the `0.2.0` version:

```sh
git tag v0.2.0
git push origin v0.2.0
```

For subsequent releases, use the new package version in the tag: `v<package.json version>`. Do not reuse or move a published tag.

The workflow verifies that the tag matches the package version and runs the app checks before building. It publishes only after all four platform packages are available, with a `SHA256SUMS.txt` checksum file. Inspect the Actions result and confirm that both macOS architectures, the Windows installer, and the Linux AppImage are present on the GitHub release. Build logs or workflow artifacts alone are not the public release downloads. Keep the release notes clear about signing status and which platforms were actually tested.

The workflow also supports **Run workflow** with an existing matching version tag. It can finish an unpublished draft after an interrupted upload, and refuses to overwrite an already public release. Use a new version for updated downloads.

The release workflow, installer identity, and app-data namespace belong to the new app. When adding signing later, use the new owner’s credentials and repository secrets; do not copy credentials from another project or commit them to source.
