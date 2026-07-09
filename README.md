# 🎥 Camera Director — Slopsmith plugin · **v3.4**

https://github.com/user-attachments/assets/d0ffaa9d-f47f-46da-9c6d-ea3b9ac7a6db

> 🇬🇧 English · [🇪🇸 Español](./README.es.md)

Floating panel to control the **3D Highway** camera in real time — orbit, pan,
zoom, tilt, height — for the guitar, drum **and** piano/keys highways, with a
**shared named-profile library** and bilingual EN/ES UI. Under **split-screen**
each panel gets its own camera, and you can steer **popped-out** panels (on
another monitor) right from the main window.

## Install

1. Copy this folder into your Slopsmith plugins directory:
   - Windows: `%APPDATA%\slopsmith-desktop\plugins\camera_director`
   - macOS: `~/Library/Application Support/slopsmith-desktop/plugins/camera_director`
   - Linux: `~/.config/slopsmith-desktop/plugins/camera_director`
2. **The bridge (Slopsmith 0.2.x):** the camera won't move until you apply the
   bridge — run `bridge/install_modded_screen.bat` (Windows, with the app
   closed). **From Slopsmith 0.3 this step won't be needed** (the bridge ships
   built in); meanwhile it's required.
3. Restart Slopsmith, open a song with the **3D Highway**, and click the 🎥 chip
   (or press `` ` ``).

## Use

Toggle **Free camera** ON, then drag the highway — **drag** = orbit · **Shift** =
pan · **Ctrl** = zoom · **Alt** = height · **wheel** = zoom. Tap any value to type
it exactly. Save any camera as a **named profile** and apply it on any panel.

### Split-screen

When you split the player, the panel row at the top of Camera Director lists each
panel by **name** (name panels in the Split Screen bar). Click a panel to target
it; the panel you're editing is highlighted and the currently-focused panel is
underlined. Camera edits apply to just that panel.

- **Profile dropdown** — apply a saved named profile to the selected panel.
- **Link all panels** — mirror one camera across every panel (tweak once, applies
  across the board).
- **Apply to all** — one-shot copy of the current panel's camera to the rest.

### Popped-out panels (multi-monitor)

Pop a panel out to its own window and it **still appears in the panel row** (marked
italic with a `⤢`) — select it to steer that window's camera from the main window,
live. You can also drag directly on the popped-out window's canvas (arm its **Free
camera** from the main window first). Everything persists to local settings.

## Changelog

### v3.x — Split-screen & multi-window
- **Per-panel cameras** in split-screen for the guitar, drum and keys highways —
  each panel renders its own camera.
- **Shared named-profile library** — save a camera as a named profile and apply it
  on any panel; per-panel assignment tracking (shows *Custom* after a manual tweak).
- **Panel selector** — a scrollable strip of panel **names**; editing follows the
  focused panel. **Link all** / **Apply to all** for across-the-board setups.
- **Steer popped-out panels from the main window**, and **drag directly** on a
  popped-out window's own canvas.

### v0.1
- Real-time camera control: orbit, pan, zoom, tilt, height.
- **3D space navigation** — Shift / Ctrl / Alt modifiers + mouse-wheel zoom.
- **Preset library** — create (named), load (or double-click), save, download
  and import.
- **Editable values** — tap a number to type an exact value/angle.
- **Draggable launcher chip** — drop it anywhere; position is remembered.
- **Metal theme**, bilingual EN/ES.

## License

AGPL-3.0-only, matching Slopsmith.
