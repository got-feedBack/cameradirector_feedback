# 🎥 Camera Director — Slopsmith plugin

> 🇬🇧 English · [🇪🇸 Español](./README.es.md)

A floating, **bilingual (EN/ES)** control panel that lets you author the
**3D Highway** camera in real time — **Orbit, Pan, Zoom, Tilt and Height** — and
**save, export and import** your favourite views as shareable JSON files.

Built as a clean **overlay layer** on top of the highway canvas. It talks to the
renderer through a single shared bridge object (`window.__h3dCamCtl`) and never
patches the renderer's internals, so it adds **no memory leaks** and can be
updated or removed independently.



https://github.com/user-attachments/assets/ba1dbb92-be79-4a7b-9ecb-d4304089d3aa



## Features

- **Live camera controls** — Height, Zoom, Orbit (yaw), Tilt (pitch), Pan X / Pan Y.
- **Drag-to-orbit** — with the free camera armed, drag anywhere on the highway to
  orbit + tilt.
- **Named presets** — save any view, reload it later with a smooth animated
  transition (uses **GSAP** when available, otherwise a built-in tween).
- **Share your views** — export a single view or your whole collection to a
  `.json` file, and import files other people share with you.
- **Bilingual UI** — switch English ⇄ Spanish on the fly; all copy lives in
  locale dictionaries, nothing is hard-coded.
- **Gothic-chic** minimalist, high-contrast theme.
- **Persistent** — your live camera and presets survive app reloads via
  `localStorage`.

## Requirements

- Slopsmith with the bundled **3D Highway** (`highway_3d`) visualization active.
- The **camera bridge** applied to `highway_3d`. The stock `highway_3d` shipped
  with Slopsmith Desktop (up to and including **0.2.9**) does **not** read the
  `window.__h3dCamCtl` bridge yet, so without it the panel opens but the camera
  won't move. This repo ships the patched renderer and a one-click installer in
  [`bridge/`](./bridge/) — see [Installing the bridge](#installing-the-bridge-required)
  below.

## Install (from GitHub)

The desktop app and the web build both discover plugins from your local plugins
directory. Clone this repo into it:

| Platform | Plugins directory |
|----------|-------------------|
| Windows  | `%APPDATA%\slopsmith-desktop\plugins\` |
| macOS    | `~/Library/Application Support/slopsmith-desktop/plugins/` |
| Linux    | `~/.config/slopsmith-desktop/plugins/` |

```bash
# Windows (PowerShell)
git clone https://github.com/nimuart/cameradirector_feedback `
  "$env:APPDATA\slopsmith-desktop\plugins\camera_director"

# macOS / Linux
git clone https://github.com/nimuart/cameradirector_feedback \
  ~/.config/slopsmith-desktop/plugins/camera_director   # adjust path per table
```

Then **restart Slopsmith**. The folder name doesn't matter, but the manifest
`id` (`camera_director`) does — keep it unique.

> Cloning with git (instead of downloading a ZIP) also lets Slopsmith's
> built-in Plugin Manager update the plugin with one click.

## Installing the bridge (required)

The plugin talks to the highway through `window.__h3dCamCtl`, but the stock
`highway_3d` bundled with Slopsmith Desktop **0.2.9 and earlier doesn't read it
yet**. The [`bridge/`](./bridge/) folder ships a patched `highway_3d/screen.js`
(built from the 0.2.9 bundle) plus install/restore scripts:

**Windows (default install in `C:\Program Files\Slopsmith`):**

1. Close Slopsmith.
2. Run `bridge/install_modded_screen.bat` (asks for admin rights). It backs
   up the original renderer as `screen.js.bak` and copies the patched one in.
3. Open Slopsmith — Camera Director now moves the camera.

To undo it, run `bridge/restore_original_screen.bat`, which restores the
backup.

**Manual / macOS / Linux:** with Slopsmith closed, back up and replace
`<app resources>/slopsmith/plugins/highway_3d/screen.js` with
`bridge/screen.js`.

> ⚠️ **App updates overwrite the bridge.** Updating Slopsmith Desktop replaces
> the bundled `highway_3d`, so re-run the installer after every app update.
> The patched file matches **Slopsmith Desktop 0.2.9** — on other versions,
> prefer waiting for a matching patch over copying this one. The long-term fix
> is upstreaming `__h3dCamCtl` support into Slopsmith's `highway_3d` — the
> exact ~30-line change is documented in [DEVELOPERS.md](./DEVELOPERS.md).

## Usage

1. Open a song and make sure the visualization is **3D Highway**.
2. Click the **🎥 chip** (top-right) or press the **`` ` ``** (back-tick) key.
3. Toggle **Free camera** ON to take over framing.
4. Drag the sliders — or drag the highway directly — until it looks beautiful.
5. **Save view**, give it a name, and it appears in the Presets list.
6. **Export** to share the `.json`; friends **Import** it to get the exact view.

Turn **Free camera** OFF at any time to hand control back to Slopsmith's
automatic camera.

## Shareable file format

Exports use a small, forward-compatible envelope:

```json
{
  "kind": "slopsmith.camera-director.preset",
  "version": 1,
  "preset": {
    "name": "Stage front",
    "cam": { "heightMul": 1.2, "distMul": 0.9, "yaw": -0.3, "pitch": 14, "panX": 0, "panY": -8 },
    "savedAt": "2026-06-09T16:00:00.000Z"
  }
}
```

A whole-collection export replaces `preset` with a `presets` array. Imports
validate the `kind` marker before applying, so people can safely swap files.

## Project layout

```
camera_director/
├── plugin.json            # Slopsmith manifest (id, script, styles)
├── screen.js              # runtime: bridge + overlay UI + i18n + persistence
├── assets/
│   ├── plugin.css         # Gothic-chic theme (served as the plugin stylesheet)
│   └── locales/           # runtime-served dictionaries (en.json, es.json)
├── bridge/
│   ├── screen.js                          # patched highway_3d renderer (reads the bridge)
│   ├── install_modded_screen.bat       # Windows: apply the bridge (backs up original)
│   └── restore_original_screen.bat   # Windows: restore the original renderer
├── src/
│   └── locales/           # canonical source for the dictionaries (edit here)
├── scripts/
│   └── sync-assets.mjs    # copies src/locales -> assets/locales
├── package.json
├── README.md / README.es.md
├── INSTALL.md / INSTALACION.md
├── DEVELOPERS.md          # how to make the bridge native in highway_3d
```

> **Editing translations:** change `src/locales/*.json`, then run `npm run build`
> to sync them into `assets/locales/` (the only place the runtime can serve from).

## How the bridge works

The renderer (`highway_3d`) reads this object every frame inside `camUpdate()`:

```js
window.__h3dCamCtl = {
  enabled,     // master switch (false → renderer auto-frames)
  heightMul,   // height multiplier
  distMul,     // dolly / zoom multiplier
  yaw,         // orbit around the look target (radians)
  pitch,       // tilt offset (highway units)
  panX, panY   // look-target pan (highway units)
};
```

Camera Director simply writes to it. That one-object contract is the whole
integration surface — no globals beyond `window.__h3dCamCtl` (the bridge) and
`window.__camDir` (this plugin's idempotent teardown handle).

## License

AGPL-3.0-only, matching Slopsmith.
