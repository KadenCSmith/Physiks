Desktop downloads built from this version's source after its automated checks passed.

| Your computer | Download |
| --- | --- |
| Mac with Apple Silicon (M-series) | `mac-arm64.dmg` |
| Mac with an Intel processor | `mac-x64.dmg` |
| Windows with an Intel/AMD 64-bit processor | `win-x64.exe` |
| Linux with an Intel/AMD 64-bit processor | `linux-x86_64.AppImage` |

The actual filenames include the app name and version. `SHA256SUMS.txt` contains checksums for all four installers. Download an installer rather than GitHub's automatically generated source archives.

The macOS builds use ad-hoc signatures and are not Apple Developer ID signed or notarized. Windows builds are not certificate signed. The operating system may require a trust decision from you before opening them. See `docs/DESKTOP.md` in this version's source for setup, signing, and platform details.

This version includes the shared app layout, replaceable examples, AI instructions and app brief, model scaffolding, and validation. Future apps can replace the examples while retaining the same release workflow.
