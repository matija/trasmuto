# Trasmuto — Product Requirements Document

## Overview

Trasmuto (Italian: "I transform") is a macOS-first desktop application that wraps `ffmpeg` for frictionless video conversion. The primary experience: drop a video file onto the dock icon and it silently converts to a smaller MP4 in the same folder. When the window is open, users can customize all conversion settings.

---

## Problem Statement

Converting a video to a smaller MP4 requires either knowing ffmpeg command-line flags or using heavy, paid GUI apps. There is no lightweight, dock-friendly tool that makes this a one-gesture operation while still offering control for power users.

---

## Goals

- **Zero-friction conversion**: Drag a video onto the dock → get a smaller MP4. No clicks required.
- **Customizable**: Expose codec, quality, resolution, and audio settings in the UI.
- **Lightweight**: The app itself should be fast to launch and have a small footprint.
- **macOS-native feel**: Overlay title bar, dark mode, native notifications.

---

## Non-Goals (v1)

- Mac App Store distribution (requires sandboxing, incompatible with arbitrary process spawning)
- Bundling ffmpeg (adds ~100MB; users are expected to have Homebrew)
- Batch queue UI (auto-started from dock drop handles concurrency silently)
- Video preview or trimming
- Subtitle, chapter, or metadata editing

---

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| App framework | Tauri v2 | Rust process spawning, proper macOS `Opened` event, tiny binary vs. Electron |
| Frontend | React 19 + TypeScript + Vite | Fast iteration, component model fits settings UI |
| Styling | Tailwind CSS v4 | Zero-runtime, compact macOS aesthetic |
| ffmpeg | System-installed (Homebrew) | Avoids binary bloat; Homebrew is ubiquitous on macOS dev machines |
| Settings store | `tauri-plugin-store` | Lightweight JSON persistence, no database overhead |
| Notifications | `tauri-plugin-notification` | Native macOS Notification Center |
| Frontend state | Zustand | Minimal boilerplate for job queue + settings |

---

## User Stories

### Primary: Dock Drop Conversion
> As a user, I drag a video file (any format) onto the Trasmuto dock icon. The app converts it to an MP4 with reduced file size in the same directory, using the same filename. A macOS notification tells me when it's done.

**Acceptance criteria:**
- Supported input formats: `.mp4`, `.mkv`, `.mov`, `.avi`, `.webm`, `.m4v`, `.flv`, `.wmv`, `.ts`, `.mts`, `.m2ts`
- Output: `<same-name>.mp4` in the same directory as input
- If input is already `.mp4`, output is `<same-name>-converted.mp4` to avoid collision
- macOS notification fires on completion and on error
- App window shows/focuses so the user can see progress

### Secondary: Settings Customization
> As a user, I open the Trasmuto window and adjust conversion settings. Those settings persist and are used for all future dock-drop conversions.

**Settings exposed in UI:**
- **Video codec**: H.264 (libx264) | H.264 Hardware (VideoToolbox) | H.265 (libx265) | H.265 Hardware (hevc_videotoolbox) | Copy (passthrough)
- **Quality (CRF)**: Slider 18–51 (lower = higher quality/larger file). Default: 23 for H.264, 28 for H.265
- **Encoding preset**: ultrafast / fast / medium / slow / veryslow (software codecs only). Default: medium
- **Max resolution**: None (keep original) | 4K (3840px) | 1080p (1920px) | 720p (1280px) | 480p (854px)
- **Audio codec**: AAC | Copy | None (strip audio)
- **Audio bitrate**: 64 / 96 / 128 / 192 / 256 kbps. Default: 128

### Tertiary: Job Queue Visibility
> As a user, I can see all active and recently completed conversions with progress, speed, and final file size.

---

## Architecture

### Dock Drop Flow

macOS sends an `NSApplicationDelegate applicationOpenURLs:` message when files are dropped on the dock icon. Tauri v2 surfaces this as `RunEvent::Opened { urls }` in the app's `.run()` callback.

```
User drops file on dock icon
        ↓
macOS sends Opened event to Trasmuto
        ↓
Rust: parse file:// URLs → validate extension → load settings from store
        ↓
Rust: spawn ffmpeg as child process
        ↓
Rust: parse -progress pipe:1 stdout → emit "conversion-progress" events (throttled ~2Hz)
        ↓
Frontend: update job item with progress bar + speed
        ↓
ffmpeg exits → emit "conversion-complete" → macOS notification
```

### ffmpeg Binary Discovery

The app looks for ffmpeg in this order (at runtime, before every conversion):
1. User-configured path (from settings store)
2. `/opt/homebrew/bin/ffmpeg` (Apple Silicon Homebrew)
3. `/usr/local/bin/ffmpeg` (Intel Homebrew)
4. `which ffmpeg` via shell (PATH fallback)

PATH-only lookup is unreliable for dock-launched apps; explicit Homebrew paths are required.

### Output MP4 Options

All outputs include `-movflags +faststart` for web-compatible MP4 structure (moov atom at front).

---

## Project Structure

```
trasmuto/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json             # macOS documentTypes, window config
│   ├── capabilities/default.json   # Tauri v2 permission grants
│   └── src/
│       ├── main.rs
│       ├── lib.rs                  # Tauri builder + RunEvent::Opened
│       ├── models.rs               # ConversionSettings, ConversionJob, ConversionProgress
│       ├── commands/
│       │   ├── convert.rs          # convert_file, cancel_conversion
│       │   ├── probe.rs            # probe_file (ffprobe metadata)
│       │   └── settings.rs         # get_settings, save_settings, get_ffmpeg_path
│       └── ffmpeg/
│           ├── finder.rs           # binary discovery
│           ├── builder.rs          # construct ffmpeg arg list
│           └── progress.rs         # parse -progress pipe:1 output
│
├── src/
│   ├── App.tsx                     # Tab nav: Queue | Settings
│   ├── components/
│   │   ├── JobQueue.tsx
│   │   ├── JobItem.tsx
│   │   └── SettingsPanel.tsx
│   ├── hooks/
│   │   ├── useJobQueue.ts
│   │   └── useConversionSettings.ts
│   └── lib/
│       ├── tauri-commands.ts       # typed invoke() + listen() wrappers
│       └── types.ts
│
├── index.html
├── vite.config.ts
├── package.json
└── PRD.md
```

---

## Tauri Commands (Frontend ↔ Rust)

| Command | Direction | Purpose |
|---|---|---|
| `convert_file(input_path, settings)` | Frontend → Rust | Start conversion, returns job ID |
| `cancel_conversion(job_id)` | Frontend → Rust | Kill ffmpeg child process |
| `probe_file(path)` | Frontend → Rust | Get duration, resolution, codec via ffprobe |
| `get_settings` | Frontend → Rust | Load persisted ConversionSettings |
| `save_settings(settings)` | Frontend → Rust | Persist ConversionSettings |
| `get_ffmpeg_path` | Frontend → Rust | Return resolved ffmpeg binary path or null |

## Events (Rust → Frontend)

| Event | Payload | Purpose |
|---|---|---|
| `conversion-progress` | job_id, out_time_ms, speed, done | Update progress bar |
| `conversion-complete` | job_id, output_path | Mark job done, show output |
| `conversion-error` | job_id, error message | Mark job failed |
| `file-opened` | Vec\<String\> paths | Populate queue when files arrive via dock |

---

## Default Conversion Preset

| Setting | Default |
|---|---|
| Video codec | H.264 software (libx264) |
| CRF | 23 |
| Preset | medium |
| Resolution | Keep original |
| Audio codec | AAC |
| Audio bitrate | 128 kbps |
| Output suffix | (none — same filename + .mp4) |

---

## Implementation Phases

### Phase 1 — Scaffold
- Initialize project with `npm create tauri-app`
- Add all Tauri plugins (notification, store, dialog)
- Stub out all commands (return dummy data)
- Wire up `RunEvent::Opened` (log only)
- Verify `cargo tauri dev` opens a window

### Phase 2 — ffmpeg Core
- `FfmpegFinder`: binary detection with Homebrew path fallbacks
- `builder.rs`: construct full ffmpeg arg list from `ConversionSettings`
- `probe.rs`: run ffprobe, parse JSON, return duration + metadata
- `convert.rs`: spawn ffmpeg, stream `-progress pipe:1` stdout, emit events
- `cancel_conversion`: store child handles, kill on request
- Test end-to-end via Tauri devtools `invoke()`

### Phase 3 — Dock Drop Integration
- Full `RunEvent::Opened` handler: URL parsing, extension filtering, settings load, job dispatch
- Emit `file-opened` event to frontend
- Show and focus main window when files arrive

### Phase 4 — Settings Persistence
- `get_settings` / `save_settings` backed by `tauri-plugin-store`
- `RunEvent::Opened` loads settings before dispatching jobs

### Phase 5 — Frontend UI
- `useJobQueue`: subscribe to conversion events, maintain job list in Zustand
- `useConversionSettings`: load on mount, save on change
- `JobItem`: filename, progress bar, speed indicator, "Reveal in Finder" button
- `SettingsPanel`: all settings as form controls (selects, sliders)
- `App`: tab navigation between Queue and Settings
- Tailwind styling: dark mode, compact macOS-like aesthetic

### Phase 6 — Notifications
- `tauri-plugin-notification` on job complete and error
- Request permission on first launch

### Phase 7 — Build & Distribution
- Generate icons from source PNG (`cargo tauri icon`)
- `cargo tauri build` → `.app` + `.dmg`
- Verify `documentTypes` registration works after `.app` install
- GitHub Actions release workflow via `tauri-action`

### Phase 8 - Tests
- Test that dropping a file on the icon works
- Test that dropping a file on the Window of the app works
- Test that a new file is created, with a new file name, in the same folder from where it was drag n dropped

---

## Open Questions / Future Work

- **Bundled ffmpeg**: For users without Homebrew, ship a static ffmpeg binary in the app bundle. Deferred due to ~100MB size increase.
- **Tray icon mode**: Run as a menu bar app with no dock icon when idle. Reduces visual clutter for power users.
- **Output directory override**: Option to redirect all conversions to a single folder (e.g., `~/Desktop/converted/`).
- **Hardware encoding auto-detect**: Automatically prefer VideoToolbox if the input is large enough to benefit.
- **Preset system**: Named presets (e.g., "Twitter", "Discord", "Archive") that bundle multiple settings.
