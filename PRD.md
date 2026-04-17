# PRD: Working DMG Release via CI

> The previous PRD (CI/CD hardening) is superseded by this document. Its goals were
> declared done but the end-to-end release pipeline was never verified — no downloadable
> binary exists on GitHub Releases. This PRD picks up from that gap.

---

## Goal

Push a version tag → CI builds a macOS `.dmg` → the `.dmg` appears as a downloadable
asset on the GitHub Releases tab → anyone can download and open it.

**Done means:** you can run `gh release download vX.Y.Z` (or click the asset link on
GitHub) and get a `.dmg` file that mounts and contains a working `Trasmuto.app`.
No phase or task is complete until this download test passes for an asset produced by
that phase's changes.

---

## What exists today

- `ci.yml` — runs lint, typecheck, tests, clippy, and `tauri build --target
  aarch64-apple-darwin` on every push to main and every PR.
- `ci.yml` (tag job) — after CI passes on main, reads the version from
  `tauri.conf.json` and pushes a semver tag if it does not already exist.
- `release.yml` — triggers on `v*.*.*` tags; uses `tauri-apps/tauri-action@v0` to
  build and publish a GitHub Release.
- Current version in `tauri.conf.json` and `Cargo.toml`: `0.1.0`.

No release assets have ever been verified as downloadable. The release workflow may be
failing silently, producing a draft, missing the DMG asset, or not running at all.

---

## Phase 1 — Diagnose: find out exactly what breaks

Read the most recent release workflow run logs on GitHub Actions. Identify the first
failing step (or confirm it never ran). Document findings as a comment on this file or
a commit message before moving to Phase 2.

Likely suspects:
- `tauri-apps/tauri-action@v0` is old — may be broken against current Tauri 2.x.
- The tag job on `ci.yml` may be failing to push the tag (PAT_TOKEN permissions).
- `targets: "all"` in `tauri.conf.json` may be attempting to build formats that fail on
  the runner (e.g. Windows targets on macOS).
- Missing system library (e.g. ffmpeg) that the app links against.
- The release is created as draft and never published.

**Phase 1 done when:** the failure point is identified and written down.
Verification: not applicable (diagnosis only).

---

## Phase 2 — Fix the release workflow

Based on Phase 1 findings, fix `release.yml` so the workflow completes without error
and attaches a `.dmg` asset to the release.

Likely changes:
- Upgrade `tauri-apps/tauri-action` to a version compatible with Tauri 2.x (check the
  action's releases page for the current stable tag).
- Ensure `releaseDraft: false` is honoured — the release must be published, not draft.
- Install any missing system dependencies (e.g. `brew install ffmpeg`) before the build
  step if the binary links against them.
- Scope `targets` in `tauri.conf.json` to `["dmg"]` or `["app", "dmg"]` to avoid
  attempting cross-platform bundles.
- If the tag job is the blocker, verify `PAT_TOKEN` is set in repo secrets and has
  `contents: write` on the target repo.

**Phase 2 done when:** `gh release download vX.Y.Z --pattern "*.dmg"` succeeds and
produces a file whose `file` output is `Mach-O` or `zlib compressed data` (a valid
DMG). Run this command locally and confirm the DMG mounts.

---

## Phase 3 — Smoke test the full push-to-download flow

Bump the version to `0.2.0` in `tauri.conf.json` and `Cargo.toml`, merge to main, and
let the auto-tag job push `v0.2.0`. Do not push the tag manually. Wait for the full
pipeline to complete end-to-end.

**Phase 3 done when:**
1. The tag `v0.2.0` appears on GitHub (pushed by the CI tag job, not manually).
2. The Release workflow run for `v0.2.0` shows green in GitHub Actions.
3. `gh release download v0.2.0 --pattern "*.dmg"` produces a valid DMG.
4. The DMG mounts on macOS and `Trasmuto.app` launches.

---

## Non-goals (for this PRD)

- Apple notarisation / code signing.
- Windows or Linux builds.
- Auto-changelog generation.
- Automatic version bump PRs.
