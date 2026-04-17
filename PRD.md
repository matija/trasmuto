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

## 5. Reduced Window Transparency

The current vibrancy/transparency effect makes the app feel lighter than native macOS utilities. This task makes the window feel more solid and grounded — closer to how Apple's own apps (e.g. Finder, Notes, System Settings) appear.

### 5.1 Window Material

- Change the Tauri window material from the current ultra-light blur (e.g. `ultraThin` / `hudWindow`) to `sidebar` or `windowBackground`.
- If a custom `NSVisualEffectView` is configured in Rust, update the `material` enum value accordingly.
- The goal: the window background should read as an opaque dark/light surface with only a subtle depth cue, not a frosted-glass pane.

### 5.2 CSS Background Fallback

- Update the root CSS custom properties so the fallback (non-vibrancy) background color matches the intended opacity — use `rgba` values with alpha ≥ 0.92 instead of the current semi-transparent values.
- Ensure `--bg-base` and `--bg-raised` remain visually consistent whether or not the OS is providing the blur layer.

### 5.3 Title Bar

- If the title bar has its own vibrancy layer (e.g. a separate `NSVisualEffectView`), apply the same material change.
- Subtle separator line between title bar and content area should remain; it adds depth without transparency.

---

## 6. Native-Style Settings Panel

The Settings tab should feel like it belongs in macOS System Settings rather than a generic web form. Key visual principles: grouped sections with inset list styling, system font sizing, and standard control heights.

### 6.1 Section Groups

- Wrap each logical group of settings (e.g. output, behavior) in a visually distinct "inset grouped" card — a rounded rectangle (`rounded-xl`) with a slightly lighter/raised background (`--bg-raised`), matching the macOS settings list pattern.
- Each group has an optional small ALL-CAPS section label (`10px`, `--fg-muted`, `tracking-widest`) above it, e.g. `OUTPUT`, `BEHAVIOR`.

### 6.2 Row Layout

Each setting row follows a strict template:
- Full-width row with `px-4 py-2.5` padding.
- Label on the left (`13px`, `font-medium`, `--fg-primary`).
- Optional description below the label (`11px`, `--fg-muted`).
- Control (toggle, select, or button) right-aligned.
- Thin hairline divider (`1px`, `--border`) between rows — **not** on the last row in a group.

### 6.3 Controls

- **Toggles**: use a pill toggle styled to match macOS (28 × 17 px, accent-color thumb, smooth 150 ms transition). No third-party library — implement in CSS.
- **Select / Dropdown**: replace `<select>` with a custom button that shows the current value and a chevron-down icon. On click, open a small popover list styled like an `NSMenu` — dark/light adaptive, `rounded-lg`, subtle shadow, `13px` rows with `8px` vertical padding.
- **Text/Number inputs**: `height: 22px`, `rounded-md`, inset border, matches macOS text field height.

### 6.4 Scrolling

- If the settings list exceeds the panel height, the section groups scroll as a unit; the panel title ("Settings") stays fixed.
- Use `-webkit-overflow-scrolling: touch` and hide the scrollbar on macOS (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).

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
5. Window material is `sidebar` or `windowBackground`; CSS background alpha is ≥ 0.92; the window reads as solid at a glance.
6. Settings panel uses inset grouped sections, proper row template, native-style toggle and custom select, and matches macOS System Settings visual language.
7. `cargo clippy -- -D warnings`, `tsc --noEmit`, and `npm run test` all pass.
