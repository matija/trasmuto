# PRD: Harden CI/CD — Build, Package, and GitHub Release

## Overview

Extend the existing CI and release workflows so that every push to `main` produces a verified macOS binary, and every semver tag publishes a proper GitHub Release with downloadable artifacts visible on the project's Releases tab.

---

## Goals

1. CI (on every push/PR) runs a full build — not just typecheck/lint/test — to catch packaging regressions early.
2. A tagged commit (`vX.Y.Z`) triggers a release workflow that:
   - Compiles a production macOS binary (`.dmg` / `.app`).
   - Creates a GitHub Release with the binary attached as a downloadable asset.
   - Marks the release as published (not draft) so it appears on the Releases tab immediately.
3. Pre-release tags (`v*-alpha`, `v*-beta`, `v*-rc`) are marked as pre-release on GitHub automatically.
4. The release workflow fails loudly and leaves no partial/orphaned release on error.

---

## Non-Goals

- Windows or Linux builds (out of scope for now).
- Auto-notarisation / Apple Developer certificate signing (nice-to-have later; unsigned builds are acceptable for now).
- Automatic version bumping or changelog generation.

---

## Current State

| Workflow | File | Gap |
|----------|------|-----|
| `CI` | `.github/workflows/ci.yml` | Runs typecheck, lint, tests, clippy — **no binary build step** |
| `Release` | `.github/workflows/release.yml` | Triggered by `v*.*.*` tags; uses `tauri-apps/tauri-action@v0` — functional but untested end-to-end; no CI build gate before release |

---

## Requirements

### R1 — CI: Add a binary build step

The CI job (runs on `push` to `main` and on PRs) must include a step that invokes `tauri build` after the existing test/lint steps.  
The compiled artifact does **not** need to be uploaded; the goal is to catch build failures before they reach the release workflow.

Acceptance criteria:
- `ci.yml` has a final step that runs `npx tauri build` (or equivalent).
- CI fails if `tauri build` exits non-zero.
- Build artifacts are not uploaded to save storage (use `--no-bundle` if faster, but the full bundle at minimum on `main` pushes).

### R2 — Release: Version consistency check

Before building, the release workflow must verify that the git tag matches the version declared in `src-tauri/tauri.conf.json` (the `version` field) and `src-tauri/Cargo.toml`.  
A mismatch should fail the workflow with a clear error message before any build work is done.

Acceptance criteria:
- A bash step extracts the version from `tauri.conf.json` and `Cargo.toml` and compares to `github.ref_name`.
- Mismatch exits 1 with a human-readable message like `Tag v1.2.0 does not match app version 1.1.0`.

### R3 — Release: Produce a macOS binary and attach to GitHub Release

The release workflow must build a `.dmg` (or `.app` in a `.zip`) and attach it to the GitHub Release using `tauri-apps/tauri-action`.  
The release must be published (not draft) on success.

Acceptance criteria:
- After a successful tag push, the GitHub Releases tab shows a release named `Trasmuto vX.Y.Z`.
- The release has at least one downloadable asset (`.dmg` preferred).
- The release body includes the tag name and a note directing users to the assets section.

### R4 — Release: Pre-release detection

Tags matching `v*-alpha.*`, `v*-beta.*`, or `v*-rc.*` are published as GitHub pre-releases.  
All other `vX.Y.Z` tags are published as stable releases.

Acceptance criteria:
- The existing `Detect prerelease` step logic is preserved and wired into `tauri-action`'s `prerelease` input.

### R5 — Release: Clean failure handling

If any step fails after the GitHub Release object has been created, the release must be converted to draft (not deleted) so it can be inspected and manually cleaned up.

Acceptance criteria:
- The existing `Mark release draft on failure` step is retained and runs on `failure()`.
- The step does not itself fail if the release does not yet exist (the `|| true` guard is preserved).

### R6 — CI gate before release

The release workflow must not begin the tauri build until CI has passed on the same commit.  
Use a GitHub Actions dependency (`needs:` or a separate required status check) or document the manual process if full automation is deferred.

Acceptance criteria (option A — automated):
- Release workflow declares `needs: [ci]` referencing a reusable CI job, or triggers only after the `CI` workflow succeeds via `workflow_run`.

Acceptance criteria (option B — deferred):
- A branch protection rule on `main` requiring the `ci` status check is documented in this PRD as a manual repo setup step, and a note is left in `release.yml` explaining the dependency.

---

## Implementation Phases

### Phase 1 — CI binary build (R1)
Add `tauri build` step to `ci.yml`. Use `--target aarch64-apple-darwin` to match the release target. Cache Rust artifacts via `swatinem/rust-cache`.

### Phase 2 — Version consistency check (R2)
Add a bash step to `release.yml` that parses `tauri.conf.json` and `Cargo.toml`, extracts versions, and asserts they match `${{ github.ref_name }}` (stripping the leading `v`).

### Phase 3 — Verify GitHub Release publication (R3, R4, R5)
Smoke-test the existing `tauri-apps/tauri-action` setup by cutting a test tag. Fix any issues found. Confirm release appears on the Releases tab with a `.dmg` asset. Confirm pre-release tags show the pre-release badge.

### Phase 4 — CI gate (R6) — DONE (Option B)
Option B implemented: a branch protection rule on `main` requiring the `ci` status check is documented in `README.md` under the "Releasing" section as a manual one-time repo setup step. A `NOTE:` comment in `release.yml` explains the dependency and why tag pushes from `main` are safe without an inline CI job.

---

## Open Questions

1. Should CI skip the full `tauri build` on PRs (expensive) and only run it on `main` pushes? A matrix strategy could split this.
2. Is unsigned `.dmg` acceptable long-term, or should we plan Apple notarisation in the next PRD?
3. For the CI gate (R6), is `workflow_run` acceptable latency, or do we prefer branch protection rules?
