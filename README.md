# Trasmuto

A macOS video converter built with Tauri, React, and TypeScript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Releasing

To publish a new release:

1. Update the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` to match the intended tag (e.g. `1.2.0`).
2. Merge to `main` and confirm the `CI` status check passes.
3. Push a semver tag:
   ```
   git tag v1.2.0 && git push origin v1.2.0
   ```
4. The `Release` workflow will build a macOS `.dmg` and publish it on the GitHub Releases tab automatically.

Use `v*-alpha.*`, `v*-beta.*`, or `v*-rc.*` tags to publish a pre-release.

### CI gate (branch protection — one-time repo setup)

The release workflow trusts that any commit on `main` has already passed CI. Enforce this by enabling branch protection on `main`:

1. Go to **Settings → Branches → Add rule** for `main`.
2. Enable **Require status checks to pass before merging**.
3. Add `ci` as a required status check.
4. Enable **Require branches to be up to date before merging**.

With this rule in place, only CI-green commits can land on `main`, so any tag pushed from `main` is guaranteed to have passed the full CI suite before the release build starts.
