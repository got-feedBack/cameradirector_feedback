# Highway bridge (`__h3dCamCtl`)

> 🇬🇧 English · [🇪🇸 Español](./README.es.md)

Camera Director drives the 3D Highway camera through a single shared object,
`window.__h3dCamCtl`, which the highway renderer reads every frame inside its
`camUpdate()`. The `highway_3d` plugin bundled with Slopsmith Desktop (up to
and including **0.2.9**) does **not** include that read yet — this folder ships
the patched renderer plus install/restore scripts.

## Contents

| File | Purpose |
|------|---------|
| `screen.js` | Patched `highway_3d` renderer (built from the Slopsmith Desktop **0.2.9** bundle) that reads `window.__h3dCamCtl`. |
| `install_modded_screen.bat` | Windows installer: backs up the original renderer as `screen.js.bak`, then copies `screen.js` into place. |
| `restore_original_screen.bat` | Windows restore: puts the `screen.js.bak` backup back and deletes it. |

## Install (Windows, default app location)

1. Close Slopsmith completely.
2. Double-click `install_modded_screen.bat` and accept the admin prompt.
3. Open Slopsmith — Camera Director can now move the camera.

The script targets the default install path:

```
C:\Program Files\Slopsmith\current\resources\slopsmith\plugins\highway_3d\screen.js
```

If Slopsmith is installed elsewhere, edit the `TARGET` line in the `.bat`, or
do the copy manually.

## Install (manual / macOS / Linux)

With Slopsmith closed:

1. Find the bundled highway renderer:
   `<app resources>/slopsmith/plugins/highway_3d/screen.js`
2. Back it up (e.g. rename a copy to `screen.js.bak`).
3. Replace it with this folder's `screen.js`.

## Uninstall

Run `restore_original_screen.bat` (Windows), or restore your manual
backup.

## ⚠️ Version notes

- The patched file corresponds to **Slopsmith Desktop 0.2.9**. Applying it to a
  different version may break the highway — on other versions, prefer a patch
  built from that version's renderer.
- **Every app update overwrites the patch** (the updater replaces the bundled
  `highway_3d`). Re-run the installer after updating.
- The clean long-term solution is upstreaming the `__h3dCamCtl` read into
  Slopsmith's own `highway_3d`, which would make this folder unnecessary. The
  exact patch and an upstreaming guide live in
  [DEVELOPERS.md](../DEVELOPERS.md).

## License

The patched `screen.js` is a modified copy of Slopsmith's `highway_3d`
renderer and remains under Slopsmith's license (AGPL-3.0), same as this
plugin.
