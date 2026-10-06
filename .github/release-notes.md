Desktop downloads built from this version's source after its automated checks passed.

| Your computer | Download |
| --- | --- |
| Mac with Apple Silicon (M-series), macOS 12+ | `mac-arm64.dmg` |
| Mac with an Intel processor, macOS 12+ | `mac-x64.dmg` |
| Windows with an Intel/AMD 64-bit processor | `win-x64.exe` |
| Linux with an Intel/AMD 64-bit processor | `linux-x86_64.AppImage` |

Filenames include the app name and version. `SHA256SUMS.txt` contains checksums for all four installers. Download an installer rather than GitHub's automatically generated source archives.

This version uses Tauri v2 and the operating system's webview, preserving the shared React layout, example models, Finder, Toolbox, equations, plots, and playback without bundling another Chromium runtime. Windows checks for WebView2 and downloads it if missing. The Linux AppImage is built on Ubuntu 22.04 using the WebKitGTK 4.1 ecosystem; compatibility varies by distribution.

Animation now follows display frames and reuses graph curves and static formulas. Displayed values default to **up to three decimal places**, without trailing zeros; choose **Toolbox → Decimal places** to select a maximum of 0–6. Calculations and editable model values retain full precision. Both simple reference models remain included.

Simulation, Finder, and Toolbox logos share a balanced bottom alignment in full, compact, and mobile headers.

For a Mac, open the DMG and then the app inside it. After macOS permits launch, one **Install and open** prompt covers copying to Applications, opening the installed copy, and ejecting and moving the installer to recoverable Trash after successful startup. Updating an existing copy uses **Replace and open** in the same prompt. **Not now** keeps the existing app and installer unchanged. Routine installed launches have no setup or cleanup prompts. Mounting the DMG alone cannot install the app or grant macOS approval.

Default Mac builds are ad-hoc signed, not Apple Developer ID signed or notarized. If you trust the download and macOS blocks it, first attempt to open it, then follow [Apple's Open Anyway instructions](https://support.apple.com/en-us/102445) in System Settings → Privacy & Security. The app cannot make that trust decision for you. Windows builds are not certificate signed. Owner-configured Mac credentials can enable Developer ID signing and notarization; check the release build's stated result before assuming they were used.

Saved desktop settings from version 0.2 are not automatically migrated to the new webview origin. This version starts from defaults and saves new settings normally. See `docs/DESKTOP.md` in this version's source for installation, local builds, identity, signing, and release details.

The AI instructions, app brief, model generator, and validation remain available. Future apps can replace the examples while retaining the interface and desktop release workflow.

Native dependency credits and the exact source archives for MPL dependencies are included in the app's resources and generated automatically for each target from the locked dependencies.
