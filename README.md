# 🎥 Camera Director — Slopsmith plugin · **v0.1**

https://github.com/user-attachments/assets/d0ffaa9d-f47f-46da-9c6d-ea3b9ac7a6db

> 🇬🇧 English · [🇪🇸 Español](./README.es.md)

Floating panel to control the **3D Highway** camera in real time — orbit, pan,
zoom, tilt, height — with a **preset library** and bilingual EN/ES UI.

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
it exactly. Save / load / download / import camera **presets**.

## Changelog

### v0.1
- Real-time camera control: orbit, pan, zoom, tilt, height.
- **3D space navigation** — Shift / Ctrl / Alt modifiers + mouse-wheel zoom.
- **Preset library** — create (named), load (or double-click), save, download
  and import.
- **Editable values** — tap a number to type an exact value/angle.
- **Draggable launcher chip** — drop it anywhere; position is remembered.
- **Metal theme**, bilingual EN/ES.
- 🚧 **Coming soon:** independent per-player cameras in split-screen.

## License

AGPL-3.0-only, matching Slopsmith.
