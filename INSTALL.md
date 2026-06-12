# 🛠️ Installation guide

> 🇬🇧 English · [🇪🇸 Español](./INSTALACION.md)

### Step 1 — Get the plugin
Clone (or download the ZIP of) the repo and place the `camera_director` folder
inside your Slopsmith plugins directory:

| System   | Plugins directory |
|----------|-------------------|
| Windows  | `%APPDATA%\slopsmith-desktop\plugins\` |
| macOS    | `~/Library/Application Support/slopsmith-desktop/plugins/` |
| Linux    | `~/.config/slopsmith-desktop/plugins/` |

```powershell
# Windows (PowerShell)
git clone https://github.com/nimuart/cameradirector_feedback "$env:APPDATA\slopsmith-desktop\plugins\camera_director"
```

> Important: what must end up directly inside `plugins/camera_director/` is the
> `plugin.json` and friends — **not** an extra nested subfolder. If you cloned a
> parent repo, copy only the `camera_director/` subfolder into the plugins
> directory.

### Step 2 — Apply the highway bridge (required)

The `highway_3d` bundled with Slopsmith Desktop (up to and including **0.2.9**)
does not read the `window.__h3dCamCtl` bridge: without this step the panel
opens but **the camera won't move**.

**Windows (default install in `C:\Program Files\Slopsmith`):**

1. **Close Slopsmith** completely.
2. Run `bridge/install_modded_screen.bat` (double-click; it asks for admin
   rights). The script:
   - backs up the original as `screen.js.bak`, and
   - copies the patched `bridge/screen.js` over
     `C:\Program Files\Slopsmith\current\resources\slopsmith\plugins\highway_3d\screen.js`.

**Manual / macOS / Linux:** with Slopsmith closed, back up
`<app resources>/slopsmith/plugins/highway_3d/screen.js` and replace it with
`bridge/screen.js`.

To go back to the original renderer: `bridge/restore_original_screen.bat`.

### Step 3 — Restart and verify

1. Open Slopsmith and load a song with the **3D Highway** visualization.
2. Click the **🎥** chip (top-right) or press the **`` ` ``** (back-tick) key.
3. Toggle **Free camera** ON and move a slider: the camera should respond.

### ⚠️ After every Slopsmith update

App updates replace the bundled `highway_3d` and **overwrite the bridge**. If
the camera stops responding after an update, re-run Step 2. The included patch
matches **Slopsmith Desktop 0.2.9**.
