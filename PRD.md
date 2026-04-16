# Trasmuto — PRD v2: Quality, Testing & Automated Releases

## Context

The initial feature set (dock drop, conversion pipeline, settings UI, job queue, notifications) is complete. This document defines the next phase: hardening the codebase through test coverage, removing dead weight, and establishing a CI/CD pipeline that automatically publishes a macOS DMG on every release tag push.

---

## Goals

1. **Test coverage** — any code path that takes input and produces output must have an automated test.
2. **Code quality** — the codebase should be simplified; dead code removed, unnecessary abstractions flattened.
3. **Automated releases** — pushing a git tag triggers a GitHub Actions workflow that builds and publishes a macOS DMG as a GitHub Release.

---

## 1. Test Coverage

### Principle

> If a function takes input and returns output (or causes a side effect), it must be tested.

The bar is: a regression cannot silently land. We do not need 100% line coverage for its own sake — we need confidence that the core transformation and decision logic is correct.

### 1.1 Rust (src-tauri)

#### ffmpeg/finder.rs — `FfmpegFinder`
- Given: `FFMPEG_PATH` env var is set → returns that path
- Given: `/opt/homebrew/bin/ffmpeg` exists on disk → returns it
- Given: `/usr/local/bin/ffmpeg` exists on disk → returns it
- Given: none of the above → returns `None` (or error)
- Tests should use a temporary directory with a fake `ffmpeg` binary (executable stub) to avoid coupling to the host machine

#### ffmpeg/builder.rs — arg list construction
- For every `ConversionSettings` field, verify the correct ffmpeg flag appears in the output arg list:
  - H.264 software → `-c:v libx264 -crf <n> -preset <p>`
  - H.264 hardware → `-c:v h264_videotoolbox`
  - H.265 software → `-c:v libx265`
  - H.265 hardware → `-c:v hevc_videotoolbox`
  - Copy video → `-c:v copy`
  - Resolution scale → `-vf scale=<w>:-2` present when set, absent when "keep original"
  - AAC audio → `-c:a aac -b:a <n>k`
  - Copy audio → `-c:a copy`
  - No audio → `-an`
  - `-movflags +faststart` always present
- Input/output path ordering: input path must precede output path in the final arg list
- Output path: same directory, same stem, `.mp4` extension; if input is already `.mp4`, `-converted.mp4` suffix applied

#### ffmpeg/progress.rs — progress line parser
- Parse a well-formed `-progress pipe:1` block → returns correct `ConversionProgress` fields
- Malformed or incomplete block → returns `None` / appropriate error without panicking
- `out_time=N/A` → handled gracefully (do not emit a progress event)

#### models.rs / settings
- `ConversionSettings::default()` returns the documented defaults (H.264, CRF 23, medium preset, AAC 128 kbps, keep resolution)
- Round-trip: serialize → deserialize → fields unchanged

#### commands/convert.rs — integration test (optional but high-value)
- Given a real (short) test video file in `tests/fixtures/`, running `convert_file` produces an `.mp4` in the same directory
- Requires ffmpeg on the test machine; skip gracefully if not found (`#[cfg_attr(..., ignore)]`)

### 1.2 Frontend (src/)

#### lib/tauri-commands.ts
- All typed wrappers must be covered by unit tests (mock `invoke` / `listen`):
  - `convertFile` calls `invoke("convert_file", { inputPath, settings })`
  - `cancelConversion` calls `invoke("cancel_conversion", { jobId })`
  - `getSettings` calls `invoke("get_settings")`
  - `saveSettings` calls `invoke("save_settings", { settings })`

#### hooks/useJobQueue.ts
- On `conversion-progress` event → job entry updated with new progress/speed values
- On `conversion-complete` event → job status set to `done`, output path recorded
- On `conversion-error` event → job status set to `error`, message recorded
- `cancelJob` calls `cancelConversion` and removes the job from state

#### hooks/useConversionSettings.ts
- On mount → calls `getSettings`, stores result
- On change → calls `saveSettings` with updated value
- Uses `vi.mock` for Tauri bridge; no real IPC in unit tests

#### Component rendering (smoke tests)
- `JobItem` renders filename, progress bar, speed, and "Reveal in Finder" button given a job in `active` state
- `JobItem` renders a completion indicator given a `done` job
- `SettingsPanel` renders all six setting controls (codec, CRF, preset, resolution, audio codec, audio bitrate)

### 1.3 Test Infrastructure Requirements
- Rust: `cargo test` runs all unit tests; integration tests gated behind a `--features integration` flag or `#[ignore]` requiring ffmpeg
- Frontend: `vitest` with `@testing-library/react`; `vi.mock('@tauri-apps/api/core')` for all Tauri bridge calls
- Both suites must pass in CI with no network access and no real ffmpeg binary (unit tests only)

---

## 2. Code Refactoring & Dead Code Removal

### Principle

> Delete anything that isn't used. Flatten anything that doesn't need to be layered. Leave the code smaller than you found it.

### 2.1 Audit and Remove Dead Code
- Run `cargo check --all-targets` and eliminate all `#[allow(dead_code)]` suppressions by either using or deleting the suppressed item
- Run `tsc --noEmit` with strict settings; eliminate all unused imports, variables, and exported symbols
- Delete any feature flags, commented-out code blocks, or `TODO` stubs that are not part of the current roadmap

### 2.2 Simplify Rust Code
- If any struct has fields that are never read outside tests, remove them
- If any function is only called from one place and its body is short, inline it
- Review `models.rs` — ensure `ConversionJob` and `ConversionProgress` contain only fields that are actively consumed by the frontend or by ffmpeg argument construction
- Collapse any `match` arms that do the same thing into a wildcard

### 2.3 Simplify Frontend Code
- Remove any `console.log` / `console.error` calls left from development
- Collapse any Zustand store slices that are never subscribed to separately
- Ensure `types.ts` and `tauri-commands.ts` have no duplicated type definitions — single source of truth

### 2.4 Acceptance Criteria for Refactoring
- `cargo clippy -- -D warnings` passes with zero warnings after refactor
- `tsc --noEmit` passes with zero errors
- `npm run lint` (ESLint) passes with zero errors
- All existing tests still pass
- No new abstractions introduced beyond what exists today

---

## 3. Automated GitHub Releases (macOS DMG)

### Trigger

A release is triggered by pushing a semver tag to `main`:

```
git tag v1.2.3
git push origin v1.2.3
```

No release is created on branch pushes or PRs — only tags matching `v*.*.*`.

### 3.1 Workflow: `release.yml`

Location: `.github/workflows/release.yml`

**Steps:**

1. **Checkout** — full clone (`fetch-depth: 0`) so `tauri-action` can read the tag
2. **Install Node** (version pinned to match `package.json` `engines` field)
3. **Install Rust** (stable toolchain, target `aarch64-apple-darwin` for Apple Silicon)
4. **Cache** — Cargo registry + build artifacts; `node_modules` via `actions/cache`
5. **Install JS dependencies** — `npm ci`
6. **Build & publish** — `tauri-action` (`tauri-apps/tauri-action@v0`):
   - `tagName`: taken from the pushed tag (`${{ github.ref_name }}`)
   - `releaseName`: `Trasmuto ${{ github.ref_name }}`
   - `releaseBody`: auto-generated from commits since last tag (or a placeholder)
   - `releaseDraft`: `false`
   - `prerelease`: `false` (set to `true` if tag contains `-beta`, `-rc`, etc. — detect via step output)
   - Artifacts uploaded: `.dmg` only (no `.app` zip for now)
7. **Notify on failure** — a failed workflow should leave the release in draft so the tag is not lost; handle via `if: failure()` step

### 3.2 macOS Runner Requirements
- Runner: `macos-latest` (Apple Silicon, `macos-14` or newer)
- Must have `ffmpeg` available for the integration test step — install via `brew install ffmpeg` if the integration test suite runs in CI (or skip integration tests in release workflow)
- Code signing: deferred. For now, build unsigned. Add a note in the workflow that a `APPLE_CERTIFICATE` secret is needed for notarization in a future phase.

### 3.3 Required GitHub Secrets
| Secret | Purpose |
|---|---|
| `GITHUB_TOKEN` | Auto-provided; used by `tauri-action` to create the release and upload assets |
| *(future)* `APPLE_CERTIFICATE` | P12 certificate for code signing |
| *(future)* `APPLE_CERTIFICATE_PASSWORD` | P12 password |
| *(future)* `APPLE_SIGNING_IDENTITY` | Developer ID string |
| *(future)* `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarization credentials |

### 3.4 Workflow: `ci.yml` (PR / push checks)

A separate, lighter workflow runs on every push to `main` and every PR:

1. Checkout
2. Install Node + Rust
3. Cache
4. `npm ci`
5. `npm run typecheck` (tsc --noEmit)
6. `npm run lint`
7. `npm run test` (vitest unit tests)
8. `cargo clippy -- -D warnings`
9. `cargo test` (unit tests only, no ffmpeg required)

This workflow must pass before a release tag is pushed.

### 3.5 Acceptance Criteria for CI/CD
- Pushing `v0.1.0` tag to `main` results in a GitHub Release named "Trasmuto v0.1.0" with a `.dmg` asset attached within ~15 minutes
- The release is published (not draft) unless the build fails
- A failed build leaves no orphaned published release
- The `ci.yml` workflow runs in under 10 minutes on a warm cache
- No hardcoded version numbers in the workflow — version is read from the git tag

---

## Out of Scope for This Phase

- Windows or Linux builds
- macOS code signing / notarization
- Homebrew tap / Sparkle auto-update
- Additional input formats or conversion presets
- UI changes

---

## Definition of Done

This phase is complete when:

1. `cargo test` and `npm run test` both pass in CI with no real ffmpeg dependency
2. `cargo clippy -- -D warnings` and `tsc --noEmit` both pass with zero issues
3. Pushing a `v*.*.*` tag to `main` automatically publishes a macOS DMG GitHub Release
4. The codebase has no dead code, no suppressed warnings, and no commented-out blocks
