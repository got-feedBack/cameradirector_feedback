# 🛠️ Instructivo de instalación

> 🇪🇸 Español · [🇬🇧 English](./INSTALL.md)

### Paso 1 — Conseguir el plugin
Cloná (o descargá el ZIP) del repo y dejá la carpeta `camera_director` dentro de
tu carpeta de plugins de Slopsmith:

| Sistema  | Carpeta de plugins |
|----------|--------------------|
| Windows  | `%APPDATA%\slopsmith-desktop\plugins\` |
| macOS    | `~/Library/Application Support/slopsmith-desktop/plugins/` |
| Linux    | `~/.config/slopsmith-desktop/plugins/` |

```powershell
# Windows (PowerShell)
git clone https://github.com/nimuart/cameradirector_feedback "$env:APPDATA\slopsmith-desktop\plugins\camera_director"
```

> Importante: lo que tiene que quedar adentro de `plugins/camera_director/` es el
> `plugin.json` y compañía — **no** una subcarpeta extra. Si clonaste el repo
> `Feedback_Plugin` entero, copiá solo la subcarpeta `camera_director/` a la
> carpeta de plugins.

### Paso 2 — Aplicar el puente al highway (obligatorio)

El `highway_3d` que trae Slopsmith Desktop (hasta la **0.2.9** inclusive) no lee
el puente `window.__h3dCamCtl`: sin este paso el panel abre pero **la cámara no
se mueve**.

**Windows (instalación por defecto en `C:\Program Files\Slopsmith`):**

1. **Cerrá Slopsmith** por completo.
2. Ejecutá `bridge/install_modded_screen.bat` (doble clic; pide permisos de
   administrador). El script:
   - hace backup del original como `screen.js.bak`, y
   - copia el `bridge/screen.js` parcheado sobre
     `C:\Program Files\Slopsmith\current\resources\slopsmith\plugins\highway_3d\screen.js`.

**Manual / macOS / Linux:** con Slopsmith cerrado, hacé backup de
`<recursos de la app>/slopsmith/plugins/highway_3d/screen.js` y reemplazalo por
`bridge/screen.js`.

Para volver al renderer original: `bridge/restore_original_screen.bat`.

### Paso 3 — Reiniciar y verificar

1. Abrí Slopsmith y cargá una canción con la visualización **3D Highway**.
2. Hacé clic en el chip **🎥** (arriba a la derecha) o apretá la tecla
   **`` ` ``** (acento grave).
3. Activá **Cámara libre** y movés un slider: la cámara tiene que responder.

### ⚠️ Después de cada actualización de Slopsmith

Las actualizaciones de la app reemplazan el `highway_3d` bundleado y **pisan el
puente**. Si después de actualizar la cámara deja de responder, volvé a correr
el Paso 2. El parche incluido corresponde a **Slopsmith Desktop 0.2.9**.

