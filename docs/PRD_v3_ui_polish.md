# Trasmuto — PRD v3: UI Polish

## Context

The app is functional and ships as a signed DMG. This phase focuses entirely on making it feel better to use: a more compact window footprint, richer feedback when a video is dropped, an option to automatically open the output file when conversion finishes, and a general visual tightening pass.

---

## Goals

1. **Smaller default window** — the app should feel like a utility panel, not a full window.
2. **Better drop experience** — dropping a video should feel satisfying and informative.
3. **Auto-open on completion** — users should be able to opt into the file opening automatically after conversion.
4. **General UI polish** — typography, spacing, iconography, and transitions cleaned up throughout.

---

## 1. Default Window Size

**Current:** 600 × 500 px  
**New:** 480 × 400 px

- Update `width` and `height` in `src-tauri/tauri.conf.json`.
- Set `minWidth: 360` and `minHeight: 320` so the window can be resized down but not to the point of clipping content.
- Verify that the Settings panel still fits without horizontal scrolling at the new default width.

---

## 2. Improved Drop Experience

### 2.1 Drop Overlay

Replace the current plain dashed border overlay with something more polished:

- Animated pulsing ring or breathing glow on the accent border.
- Display the number of videos being dropped (e.g. "Drop 2 videos to convert") when multiple files are in flight.
- Icon: use a film-strip or play-arrow icon, not an upload arrow.
- Transition: fade in (100 ms ease-out) on enter, fade out (80 ms ease-in) on leave.

### 2.2 Post-Drop Feedback

When a drop lands and jobs are queued:

- Each `JobItem` enters with a brief slide-in animation (translateY from +6px, opacity from 0, 150 ms ease-out) rather than appearing instantly.
- Show the video thumbnail or a generic film-strip placeholder next to the filename (16 × 16 px icon, not a real video frame — keep it simple and fast).

---

## 3. Auto-Open on Completion

### 3.1 Setting

Add a new boolean setting `openAfterConversion` (default: `false`) to `ConversionSettings`.

- Wire it through the Rust model (`models.rs`) and the settings persistence layer.
- Expose it in the Settings panel as a toggle: **"Open file when done"**, placed at the bottom of the settings list.

### 3.2 Behavior

When `openAfterConversion` is `true` and a job transitions to `done`:

- Call `openPath(job.outputPath)` via `@tauri-apps/plugin-opener`.
- Only open automatically if the job completed without user cancellation and has a valid `outputPath`.
- Do not open if another job is still running (avoid flooding Finder/QuickTime with multiple files).

### 3.3 Manual Reveal

Regardless of the auto-open setting, the "Reveal" button on a completed `JobItem` should remain. Rename it to **"Show in Finder"** for clarity.

---

## 4. General UI Polish

### 4.1 Typography

- Filename in `JobItem`: bump to `14px`, keep `font-medium`.
- Status badges: replace all-caps tracking with sentence-case (e.g. `CONVERTING` → `Converting`). Already done in labels but ensure the CSS class removes `uppercase tracking-wide`.
- Empty-state headline ("Drop a video to convert"): bump to `14px font-semibold`.

### 4.2 Spacing and Layout

- `JobItem` vertical padding: increase from `py-2.5` to `py-3` for more breathing room.
- Title bar height: reduce from `h-11` (44 px) to `h-10` (40 px) to recover vertical space.
- Progress bar height: increase from `h-1` to `h-[3px]` — still slim but easier to perceive.

### 4.3 Segmented Control

- Pill shape: use `rounded-full` on the container and `rounded-full` on the active pill instead of `rounded-md` / `rounded-[5px]`.
- Font size: keep `13px` but use `font-medium` on both active and inactive labels (active is already medium, inactive currently inherits default weight).

### 4.4 Job Item — Done State

- When a job is `done`, show a small checkmark icon (12 × 12) in the success color instead of only a text badge.
- Dim the filename to `--fg-muted` once done to visually de-emphasize completed items.

### 4.5 Empty State

- Replace the current plain video icon with a slightly larger (48 × 48) one with a soft tinted background circle.
- Subtext ("Drag onto this window or the dock icon"): wrap to two lines if needed but reduce font to `11px`.

---

## Out of Scope for This Phase

- Real video thumbnail extraction.
- Windows / Linux builds.
- Notification changes.
- Batch presets or additional codec options.

---

## Definition of Done

1. Default window opens at 480 × 400 px.
2. Dropping a video shows the polished animated overlay with correct copy and icon.
3. `openAfterConversion` setting persists, and when enabled, the output file opens automatically on completion.
4. All listed typography, spacing, and badge changes are applied.
5. `cargo clippy -- -D warnings`, `tsc --noEmit`, and `npm run test` all pass.
