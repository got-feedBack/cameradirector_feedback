# 🎥 Camera Director — Slopsmith plugin

> 🇬🇧 English · [🇪🇸 Español](./README.es.md)

A floating, **bilingual (EN/ES)** control panel that lets you author the
**3D Highway** camera in real time — **Orbit, Pan, Zoom, Tilt and Height** — with
**two independent player profiles** and a **preset library** you can save,
export and import.

https://github.com/user-attachments/assets/ba1dbb92-be79-4a7b-9ecb-d4304089d3aa

## Features

- **Player 1 / Player 2** — a toggle at the top switches between two profiles,
  each with its own live camera **and** its own presets. The panel recolors to
  tell them apart (blue = P1, amber = P2). **Click the number** to rename a
  player to anything you like.
- **Live camera controls** — Height, Zoom, Orbit, Tilt, Pan X / Pan Y, plus
  drag-to-orbit directly on the highway.
- **Presets** — one place to **save**, **load**, **export** and **import** views.
  Two are built in: **Default** (neutral) and **Rocksmith** (classic-style
  framing).
- **Shareable** — export a preset to a `.json` file; others import it to get the
  exact view.
- **Smart chip** — the 🎥 launcher only appears while a song is open **and** the
  3D Highway is the active visualization.
- **Slopsmith-native look** — brushed-metal panel, themed in Slopsmith colors.

## Install

### Slopsmith 0.3+ — just the plugin

From Slopsmith **0.3** onward the camera bridge ships inside the app, so there's
nothing else to do: drop this plugin into your plugins folder and restart.

| Platform | Plugins directory |
|----------|-------------------|
| Windows  | `%APPDATA%\slopsmith-desktop\plugins\` |
| macOS    | `~/Library/Application Support/slopsmith-desktop/plugins/` |
| Linux    | `~/.config/slopsmith-desktop/plugins/` |

```powershell
# Windows (PowerShell) — clone so the Plugin Manager can update it later
git clone https://github.com/nimuart/cameradirector_feedback "$env:APPDATA\slopsmith-desktop\plugins\camera_director"
```

Then **restart Slopsmith**. The folder name doesn't matter, but the manifest
`id` (`camera_director`) does.

### Slopsmith 0.2.9 and earlier — one extra step

These versions don't read the camera bridge yet, so the panel opens but the
camera won't move until you apply the bundled patch. See **[INSTALL.md](./INSTALL.md)**
(or run `bridge/install_modded_screen.bat` on Windows). Full details in
[`bridge/`](./bridge/).

## Usage

1. Open a song with the **3D Highway** visualization — the 🎥 chip appears.
2. Click it (or press **`` ` ``**) and pick **Player 1** or **Player 2**.
3. Toggle **Free camera** ON, then drag the sliders or the highway.
4. **Save preset** to keep a view; **Export** to share it.

Turn **Free camera** OFF to hand control back to Slopsmith's auto-camera.

## Preset file format

```json
{
  "kind": "slopsmith.camera-director.preset",
  "version": 1,
  "preset": {
    "name": "Stage front",
    "cam": { "heightMul": 1.2, "distMul": 0.9, "yaw": -0.3, "pitch": 14, "panX": 0, "panY": -8 }
  }
}
```

Imports validate the `kind` marker before applying, so files are safe to swap.

## The bridge (0.2.9 and earlier)

Camera Director drives the highway through one shared object,
`window.__h3dCamCtl`, read by `highway_3d` each frame. On 0.2.9 and earlier the
[`bridge/`](./bridge/) folder patches the renderer to read it; from 0.3 it's
native. The exact change (for maintainers) is in [DEVELOPERS.md](./DEVELOPERS.md).

## License

AGPL-3.0-only, matching Slopsmith.
