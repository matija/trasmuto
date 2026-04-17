# Trasmuto

A macOS desktop app for converting video files. Built with Tauri, React, and TypeScript.
You drag in a video, pick your output settings, and it converts it.

## Download

Get the latest release from the [releases page](https://github.com/matija/trasmuto/releases/latest).

## First launch on macOS

macOS will block the app on first run because it isn't notarized. To open it anyway, right-click the app and choose **Open** — you'll get a warning dialog with an Open button.

If that doesn't work, run this in Terminal after moving the app to `/Applications`:

```sh
xattr -d com.apple.quarantine /Applications/Trasmuto.app
```

## Releasing

Bump the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, merge to main,
then push a semver tag (e.g. `git tag v1.2.0 && git push origin v1.2.0`).

The release workflow builds a macOS `.dmg` and publishes it to GitHub Releases.
Pre-release tags (`v*-alpha`, `v*-beta`, `v*-rc`) are marked as pre-release automatically.
