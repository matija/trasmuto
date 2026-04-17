# Trasmuto — PRD v4: Dock Drop, Compact Window, Completion Actions

## Context

The app ships, converts reliably, and looks polished. This phase focuses on three gaps:
converting videos dropped onto the dock icon (the most natural macOS gesture for a converter),
a smaller and more intentionally designed window, and richer post-conversion affordances
(play the result, delete it) rather than just a passive "done" badge.

---

## Goals

1. **Dock-icon drop** — conversion starts whether the app is open or closed when a video is dropped on the dock icon.
2. **Compact, intricate window** — smaller default footprint, but the design uses that constraint to add refinement rather than subtract it.
3. **Completion actions** — a finished job communicates clearly that it is done, and lets the user play the output or delete it without opening Finder.

---

## 1. Dock-Icon Drop

### 1.1 How macOS Delivers Files Dropped on the Dock

macOS routes dock-icon drops through `NSApplicationDelegate.application(_:openFiles:)` (multiple files) and `application(_:open:)` (single URL). When the app is already running, those delegates fire immediately. When the app is not running, macOS launches it and delivers the files before `applicationDidFinishLaunching` returns.

Tauri v2 exposes this through the `tauri-plugin-deep-link` file-open event **or** via a raw `AppDelegate` override in `src-tauri/src/lib.rs` / a Swift/ObjC delegate shim. Use whichever path requires fewer moving parts given the existing code.

### 1.2 macOS App Bundle Registration

For the dock to accept a file drag at all, the bundle must declare the UTIs it handles in `tauri.conf.json` under `bundle.macOS.associations` (Tauri v2 syntax):

```json
"bundle": {
  "macOS": {
    "associations": [
      { "name": "Video",      "role": "Viewer", "rank": "Alternate",
        "utis": ["public.movie", "public.mpeg-4", "com.apple.quicktime-movie",
                 "public.avi", "org.matroska.mkv", "com.microsoft.wma"] }
    ]
  }
}
```

The `Alternate` rank signals that Trasmuto is not the default handler but will accept the file. After a build, run `lsregister -kill -r -domain local -domain system -domain user` in the test environment to flush the LS cache.

### 1.3 Tauri-Side Event Handling

Add a `file_open` listener in the setup closure (or an equivalent Tauri event). Map each incoming path through the same validation and queuing logic that the window drop path already uses. Do not duplicate the conversion pipeline — factor out a `fn enqueue_paths(paths: Vec<PathBuf>, state: &AppState)` helper that both the existing window-drop handler and the new dock handler call.

### 1.4 App-Closed Launch Path

When the app is launched by macOS to handle a dock drop (cold start), there is a race between `setup` completing and the file-open delegate firing. Guard against this:

- Buffer incoming paths in the AppDelegate / event listener before the main window is ready.
- Once `window-created` or `ready` fires on the Tauri app handle, drain the buffer into `enqueue_paths`.

### 1.5 Testing Checklist

- Drop one video on the dock icon while app is **running** → job appears and converts.
- Drop three videos at once while app is **running** → three jobs queued.
- Quit the app, drop a video on the dock icon → app launches, window appears, job starts automatically.
- Drop a non-video file (e.g. `.txt`) → app launches/focuses but no job is created; no crash.

---

## 2. Compact, Intricate Window

### 2.1 Target Size

**Default:** 400 × 320 px  
**Min:** 340 × 260 px  
**Max:** none (user can resize freely)

These are ≈ 17 % smaller than the current 480 × 400. At this size, every pixel carries more visual weight — the design should acknowledge that through intentional detail work rather than just scaling everything down.

### 2.2 Design Language: "Instrument Panel"

The reference is the interior of a well-made precision tool — a watch movement, a professional audio interface, an early Mac desktop accessory. Characteristics:

- **Ruled geometry.** Every edge aligns to a consistent 4 px grid. No soft blobs or decorative shapes that aren't load-bearing.
- **Typographic precision.** Two weights only: `font-medium` (labels, filenames) and `font-normal` (muted, metadata). No bold. Letter-spacing on ALL-CAPS labels: `+0.06em`.
- **Material contrast.** Title bar and content area read as two distinct surfaces. Title bar: `--bg-raised` (slightly elevated). Content: `--bg-base`. Separator: 1 px hairline at `--border`, no blur or gradient.
- **Tight, uneven padding.** The content area uses `px-3 pt-2 pb-3` — a deliberate slight bottom-heaviness that sits naturally with the macOS window shadow below.
- **Accent restraint.** The accent color (blue) appears only on active progress bars and the active segmented-control pill. Everywhere else uses `--fg-muted` for secondary information.

### 2.3 Title Bar

- Height: **36 px** (down from 40 px). Traffic-light buttons sit at `y: 10 px`, vertically centered.
- App name: omit or reduce to an icon-only mark at 14 × 14 px, centered, `--fg-muted`. The window is small enough that the name wastes space.
- Tab bar (Convert / Settings) moves into the title bar row, right of the traffic lights, using the existing segmented control component. This removes the separate tab-bar row, recovering ~32 px of vertical space.

### 2.4 Segmented Control in Title Bar

- Container: `height: 22px`, `rounded-full`, background `--bg-base` (inset from title bar surface).
- Active pill: `rounded-full`, accent background with 0.12 opacity, accent text; smooth 120 ms ease transition.
- Labels: 12 px, `font-medium`, `tracking-[0.02em]`.
- Sits in the horizontal center of the title bar (or slightly right-of-center to avoid traffic lights).

### 2.5 Empty State

- Icon: 36 × 36 px, `--fg-muted` opacity 0.4. No background circle.
- Headline: 13 px, `font-medium`, `--fg-primary`. "Drop a video to convert."
- Subtext: 11 px, `--fg-muted`. "Or drag onto the dock icon." (two lines max)
- Vertical centering uses `flex flex-col items-center justify-center` with `gap-1.5`.

---

## 3. Completion Actions

### 3.1 Done State Visual

When a job reaches `done`:

- The progress bar is replaced by a **solid hairline rule** (1 px, `--border`) at the same vertical position — the slot is not collapsed, preserving list rhythm.
- A **checkmark glyph** (SF Symbol `checkmark` or equivalent, 11 × 11 px) appears left of the filename in `--color-success` (system green).
- Filename color shifts to `--fg-muted` (de-emphasised but still readable).
- Status badge: replaced by an inline action row (see §3.2).

### 3.2 Inline Action Row

Below the filename (same row expansion, not a separate list item), two compact buttons appear on job completion:

| Button | Label | Action |
|--------|-------|--------|
| Play   | "Play" | `openPath(job.outputPath)` — opens in the default video player |
| Delete | "Delete" | Moves `job.outputPath` to Trash (via `trash` Tauri command or `NSFileManager`); removes the job from the list after a 300 ms fade-out |

Button styling:
- Pill shape, `height: 20px`, `px-2.5`, `rounded-full`.
- "Play": `--bg-raised` fill, `--fg-primary` text, 12 px.
- "Delete": no fill, `--fg-danger` text (system red at 0.75 opacity), 12 px. On hover, text goes to full opacity.
- Gap between buttons: `6px`.
- The row fades in with the same 150 ms ease-in used elsewhere.

### 3.3 Delete Confirmation

No modal. The button label changes to **"Sure?"** on first click (300 ms window). A second click within that window executes the delete. A click elsewhere or a 300 ms timeout resets to "Delete". This avoids a dialog while still protecting against fat-finger deletions.

### 3.4 Error State

If the output file is missing when "Play" or "Delete" is clicked (e.g. the user already moved it in Finder):

- Show a brief inline message at the button row: "File not found" in `--fg-muted`, replacing the buttons for 2 s before restoring them.
- Do not crash or show an OS alert.

### 3.5 Job List Housekeeping

Once a job is deleted (file trashed, item removed), the list reflows without jank: use `height` transition from auto to `0` (or a `max-height` animation) over 200 ms before unmounting. If the list becomes empty after deletion, show the empty state.

---

## Out of Scope

- Batch rename or output-path customisation.
- Windows / Linux builds.
- Progress notifications in Notification Center.
- Any codec or format additions.

---

## Definition of Done

1. Dropping a video onto the dock icon starts conversion — both when the app is running and when it is not.
2. A non-video file dropped on the dock icon does not crash or create a bad job.
3. Default window opens at 400 × 320 px; segmented control lives in the title bar row.
4. Visual language matches the "Instrument Panel" description: ruled geometry, two weights, accent restraint.
5. A completed job shows a checkmark, dimmed filename, and Play / Delete buttons; no status badge.
6. "Delete" requires a two-click confirm; file is moved to Trash; item animates out; list reflows cleanly.
7. "Play" opens the output in the default player; missing-file error is shown inline if the file is gone.
8. `cargo clippy -- -D warnings`, `tsc --noEmit`, and `npm run test` all pass.
