# Desktop builds and releases

The Tauri v2 wrapper displays the same React app used by the browser. It loads the bundled frontend through the operating system's webview: WKWebView on Mac, WebView2 on Windows, and WebKitGTK on Linux. It does not ship another Chromium runtime. The models, calculations, scenes, Finder, Toolbox, equations, plots, and playback remain in the shared frontend.

## Download and install

Open the repository's **Releases** page and choose the asset for your system and processor. Each release supplies `SHA256SUMS.txt`; filenames include the normalized app name and version.

| System | Processor | Package | Runtime baseline |
| --- | --- | --- | --- |
| macOS | Apple silicon · arm64 | `mac-arm64.dmg` | macOS 12 or later |
| macOS | Intel · x64 | `mac-x64.dmg` | macOS 12 or later |
| Windows | Intel/AMD · x64 | `win-x64.exe` | WebView2; the installer checks and downloads it if missing |
| Linux | Intel/AMD · x64 | `linux-x86_64.AppImage` | WebKitGTK 4.1 ecosystem; built on Ubuntu 22.04 |

These are separate builds. The Linux baseline does not establish compatibility with every distribution; inspect and test each packaged app on the systems you support. An AppImage can still be larger than the Mac package because it carries Linux libraries. For an AppImage, enable its executable permission before opening it. See Tauri's [AppImage guidance](https://v2.tauri.app/distribute/appimage/).

Windows uses Tauri's `downloadBootstrapper` WebView2 installation mode. If the runtime is absent, installation needs internet access; the app itself uses bundled local content. Keep that runtime check when customizing the installer. See [Windows installer options](https://v2.tauri.app/distribute/windows-installer/).

### Mac first launch

1. Open the correct DMG, then open the app inside the mounted image. Mounting the disk image alone does not start an installer.
2. If macOS blocks an app you trust, first attempt to open it, then go to **System Settings → Privacy & Security → Open Anyway** and confirm the system prompt. Follow [Apple's official instructions](https://support.apple.com/en-us/102445). A damaged or malware warning needs investigation, not an automatic exception.
3. Once macOS permits launch, one prompt offers **Install and open** or **Not now**. Installing copies the app into `/Applications`, or your personal `~/Applications` folder if the system folder is not writable. The same prompt explains that, after the verified installed copy opens, its installer disk will be ejected and the exact original DMG moved to recoverable Trash. **Not now** keeps the existing app and installer unchanged.
4. If the destination contains the same app identity and that app is not running, the one prompt instead offers **Replace and open** and explains that the previous copy will move to recoverable Trash after verification. A different app, unexpected file, symlink, or running copy is never overwritten. Quit a running copy before trying again.
5. The installed copy shows its main window and confirms startup before cleanup. The private installation session carries the original consent, so there is no second cleanup confirmation. Cleanup rechecks the exact original installer and its mounted disk, ejects without forcing, and moves only that DMG to Trash. Missing consent, a failed launch, or an ambiguous or changed installer leaves it in place. Normal launches of the installed app show no installation or cleanup prompts; native error messages appear only for actionable failures. macOS may still require its own security or permission prompts.

The helper cannot approve a Gatekeeper decision before the app runs. It preserves quarantine and signatures and does not change macOS trust settings. A failed launch keeps the installer. If macOS launches a translocated copy, the helper proceeds only when it can identify one original mounted bundle with the same signed identity and version; missing or ambiguous matches skip installation. Dragging the app to Applications remains a normal manual installation path.

### Signing status

The version 0.3 wrapper uses an **ad-hoc Mac signature** by default (`signingIdentity: "-"`) with hardened runtime. It is **not Developer ID signed or notarized** unless the owner supplies the required credentials and the release build successfully completes those steps. Windows certificate signing is not configured. No signing credentials are included in this repository, and none were available when the default release configuration was prepared.

Ad-hoc signing is different from an Apple-verified distribution identity. A smaller Tauri package does not change Gatekeeper's requirements. See [Tauri's Mac signing guide](https://v2.tauri.app/distribute/sign/macos/).

## Brand a new app

1. Set a unique `id` and the desired `title` in [`src/app.config.ts`](../src/app.config.ts). The ID isolates saved model parameters.
2. Update the package `name`, `version`, and `description` in [`package.json`](../package.json), and synchronize `package-lock.json`. The release tag must match the package version.
3. Build once and inspect `dist/app-metadata.json`. Vite generates it from the actual configuration and package metadata; do not edit it by hand.
4. Review the derived desktop identity, icons, and platform settings. Product names remove filesystem-invalid punctuation; the frontend keeps its configured title.
5. Check the app, inspect its native window, and launch a packaged build. Verify branding, saved-data isolation, controls, Finder, playback, and links before tagging a release.

[`desktop/identity.cjs`](../desktop/identity.cjs) exports `readDesktopIdentity(distDir)`. It derives `productName` from the title, `appId` and `storageName` as `app.cinematic.<app id>`, `executableName` from the normalized package name, and `version` from the built metadata. [`scripts/desktop.mjs`](../scripts/desktop.mjs) and [`desktop/build-config.mjs`](../desktop/build-config.mjs) use this identity to generate Tauri build overrides. A template copy therefore has one branding source. Review native defaults in [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json).

Browser and desktop settings are separate. Version 0.2's Electron storage origin also differs from Tauri's origin, so existing desktop settings are not automatically migrated. Version 0.3 starts from defaults and saves subsequent changes normally.

## Build locally

Use the Node version required by `package.json` and Rust **1.99.0**. The npm lockfile pins Tauri CLI **2.12.1**. Install the native [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for the build host:

- **Mac:** Xcode command-line tools and a macOS Rust target.
- **Windows:** Microsoft C++ Build Tools with the desktop C++ workload, the MSVC Rust target, and WebView2.
- **Ubuntu/Debian:** compiler tools, WebKitGTK 4.1 development headers, SSL, app-indicator, SVG, and the packaging dependencies used by the release workflow. Its Ubuntu 22.04 job records the exact package list.

Then run:

```sh
npm ci
npm run check
npm run desktop:dev
```

`desktop:dev` builds and opens the local bundled app. It is not a hot-reloading server; use `npm run dev` for the browser development loop.

```sh
npm run desktop:pack
npm run desktop:build
```

`desktop:pack` creates a local application for inspection. `desktop:build` creates the current platform's installer. Downloadable outputs are normalized under the ignored `release/` directory; native compilation artifacts remain under `src-tauri/target/`.

Every desktop build fetches the locked Cargo dependencies, then generates target-specific native credits offline with `scripts/native-notices.mjs`. The app resources include `notices/NATIVE_NOTICES.txt`, the dependency inventory, and exact unmodified MPL source archives verified against `Cargo.lock`. Versioned, checksum-verified license overrides live in `desktop/license-overrides`; new missing license text stops packaging rather than silently omitting credits. The renderer's `THIRD_PARTY_NOTICES.txt` and all font files remain bundled separately.

A specific architecture can be selected with `--target`, provided the target is installed and supported by the build host. For example, on a Mac with the corresponding Rust target installed:

```sh
npm run desktop:build -- --target aarch64-apple-darwin
```

The release matrix uses `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc`, and `x86_64-unknown-linux-gnu`. A local build does not produce or verify all four targets. Use native runners for the supported workflow.

The desktop entry point is [`src-tauri/src/main.rs`](../src-tauri/src/main.rs); the Mac helper lives in [`src-tauri/src/install.rs`](../src-tauri/src/install.rs). Keep domain logic in the existing frontend modules. Inspect actual webview math, SVG interactions, keyboard input, external links, model switching, saved settings, and playback when changing the wrapper.

## Configure certificate-backed Mac distribution

For distribution outside the App Store, obtain a **Developer ID Application** certificate with its private key and a paid Apple Developer account. Export the identity as a password-protected `.p12` and store its base64 content as a repository secret. The provided workflow uses these six GitHub Actions secrets together:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` containing the signing identity and private key |
| `APPLE_CERTIFICATE_PASSWORD` | Password used to export that `.p12` |
| `APPLE_SIGNING_IDENTITY` | Exact Developer ID Application identity name |
| `APPLE_ID` | Apple account email |
| `APPLE_PASSWORD` | An Apple **app-specific password**, not the account's normal password |
| `APPLE_TEAM_ID` | Apple Developer team ID |

The workflow enables this path only when all six secrets are supplied. If none are present, it uses the stated ad-hoc configuration. A partially configured set fails the release and lists only the missing secret names. Keep values out of source, terminal output, and release notes. Verify the completed signing, notarization, and stapling results before describing a release as notarized.

Tauri also supports App Store Connect API notarization through `APPLE_API_ISSUER`, `APPLE_API_KEY` (the key ID), and `APPLE_API_KEY_PATH` (the actual private `.p8` file path). That alternative needs workflow changes to securely materialize the key file; a secret string is not a path. Use one complete authentication method. Details are in the [official notarization instructions](https://v2.tauri.app/distribute/sign/macos/#notarization).

## Publish versioned downloads

[`release.yml`](../.github/workflows/release.yml) runs for a version tag. Commit the application and matching package/lockfile version first. For version 0.3.1:

```sh
git tag v0.3.1
git push origin v0.3.1
```

Use a new `v<package.json version>` for each release. Do not reuse or move a published tag.

The workflow verifies the tag, runs the app checks, and builds four native targets. It publishes the installer set and `SHA256SUMS.txt` only after every target succeeds. Inspect the Actions result and confirm both Mac architectures, Windows installer, and Linux AppImage appear on the public release. Build logs and temporary workflow artifacts are not public downloads. Record which platforms were actually opened and tested.

**Run workflow** also accepts an existing matching version tag. It can finish an unpublished draft after an interrupted upload and refuses to replace an already public release. The new app owns its release workflow, identifiers, credentials, and saved-data namespace; do not copy another project's signing secrets.
