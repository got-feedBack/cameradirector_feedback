# 🧭 Guía rápida — Camera Director (cómo funciona, qué archivos importan, cómo instalar)

## 1. Los DOS `screen.js` (esto es lo que te confunde)

Hay **dos** archivos llamados `screen.js` y son cosas distintas:

| Archivo | Qué es | ¿Alimenta tu plugin? |
|---------|--------|----------------------|
| **`camera_director/camera-controller.js`** (este repo) | El **cerebro del PLUGIN**. Controla la cámara, players, presets, split. | ✅ **SÍ.** Este ES tu plugin. |
| **`highway_3d/screen.js`** (adentro de Slopsmith) | El **renderer** que dibuja el highway 3D y *lee* la cámara. Es parte de Slopsmith, no del plugin. | ❌ No. Es de Slopsmith. |

> 🔤 **Nota de nombres:** el cerebro del plugin se llama `camera-controller.js`
> (a propósito, para NO chocar con el `screen.js` del renderer). Slopsmith igual
> lo pide por la URL `/screen.js`, pero el backend sirve el archivo que indica
> `plugin.json` → `"script": "camera-controller.js"`. Por eso funciona aunque el
> archivo no se llame `screen.js`.

> En este repo, `bridge/screen.js` es una **copia parcheada del renderer** (el de
> `highway_3d`), que solo hace falta en Slopsmith **0.2.x** para que la cámara
> responda. Desde 0.3 el renderer ya trae el puente y `bridge/` no se usa.

**Cómo se hablan:** tu plugin escribe un objeto `window.__h3dCamCtl` (la cámara);
el renderer lo lee cada frame. Ese objeto es el único punto de contacto.

## 2. Arquitectura del plugin (v3.0.0) — cerebro + UI separados

Desde la v3 separé el plugin en dos piezas:

- **`camera-controller.js` = el cerebro** (estable). Cámara, perfiles por
  player, presets, persistencia, navegación Blender, split. **No tiene nada de
  UI.** Expone una API en `window.__camDir` y, al final, **carga la UI**.
- **`assets/ui-panel.js` = la UI** (lo visual). Panel, chip, sliders, tabs,
  botones, animaciones. Llama al cerebro por `window.__camDir`. Podés editar
  esto y el CSS sin tocar el cerebro.

> Por eso podés actualizar lo visual (UI + CSS) sin volver a tocar el
> `camera-controller.js` "cerebro". El cerebro es el que se mantiene estable.

## 3. Qué archivos importan (y cuáles no)

**Runtime (lo que Slopsmith usa para que el plugin funcione):**
- `plugin.json` — manifiesto (nombre, id, qué archivos cargar).
- `camera-controller.js` — el cerebro. ← lo carga Slopsmith (apuntado por `"script"`).
- `assets/ui-panel.js` — la UI. ← la carga el cerebro.
- `assets/plugin.css` — estilos. ← lo carga Slopsmith (campo `"styles"`).
- `assets/locales/en.json`, `es.json` — textos (EN/ES).
- `assets/img/*.png` — fondo del panel y botones.

**Solo para Slopsmith 0.2.x:**
- `bridge/screen.js` + `bridge/*.bat` — parche del renderer (ver `INSTALL.md`).

**Documentación / build (NO afectan el runtime):**
- `README.md`, `README.es.md`, `INSTALL.md`, `INSTALACION.md`, `DEVELOPERS.md`,
  `GUIA.md`, `LICENSE`.
- `src/locales/*` + `scripts/sync-assets.mjs` — fuente de los textos y el script
  que los copia a `assets/locales/` (corrés `npm run build` tras editarlos).
- `package.json` — metadatos del paquete.

## 4. Cómo carga Slopsmith el plugin (la cadena)

```
Slopsmith arranca
   └─ lee plugin.json  → "script": "camera-controller.js", "styles": "assets/plugin.css"
        ├─ inyecta assets/plugin.css                  (estilos)
        └─ pide la URL /api/plugins/camera_director/screen.js
              (el backend devuelve el archivo "script" = camera-controller.js)
              └─ camera-controller.js crea window.__camDir y carga assets/ui-panel.js
                    └─ ui-panel.js dibuja el panel + chip usando window.__camDir
```

⚠️ **Importante:** como el cerebro carga `assets/ui-panel.js`, **ese archivo
TIENE que existir** en la carpeta del plugin. Si falta, el panel no aparece.

## 5. Cómo instalar (manual)

1. Copiá la carpeta del plugin (con `plugin.json`, `screen.js`, `assets/`, etc.)
   dentro de la carpeta de plugins de Slopsmith:
   - Windows: `%APPDATA%\slopsmith-desktop\plugins\camera_director`
   - macOS: `~/Library/Application Support/slopsmith-desktop/plugins/camera_director`
   - Linux: `~/.config/slopsmith-desktop/plugins/camera_director`
2. **Slopsmith 0.2.x:** además aplicá el puente → corré
   `bridge/install_modded_screen.bat` (Windows) con Slopsmith cerrado.
   (En 0.3+ este paso no hace falta.)
3. Reiniciá Slopsmith. Abrí una canción con el **3D Highway**.

> Si lo clonás con `git clone` dentro de la carpeta de plugins, además podés
> actualizarlo después con el Plugin Manager.

## 6. Comparación con tu GitHub (hoy)

Tu repo `github.com/nimuart/cameradirector_feedback` está **atrasado**: tiene la
**v1.0.0 vieja** (un solo `screen.js` de ~22 KB con TODO adentro, **sin**
`assets/ui-panel.js`, sin players/split, CSS y locales viejos). Ojo: en GitHub
el cerebro todavía se llama `screen.js`; en la v3 local pasó a llamarse
`camera-controller.js`, así que al subir hay que **borrar el viejo `screen.js`**
del repo y agregar `camera-controller.js`.

La versión **local (v3.0.0)** es la nueva (cerebro + UI separados, split por
player, etc.) y **todavía no está pusheada**.

**Si vas a subir la v3 a GitHub, tenés que subir SÍ o SÍ los dos archivos nuevos
del runtime** (si no, el plugin se rompe porque el cerebro busca la UI):

```bash
git rm screen.js                       # quitar el cerebro viejo (renombrado)
git add camera-controller.js assets/ui-panel.js assets/plugin.css assets/locales \
        assets/img plugin.json DEVELOPERS.md GUIA.md
git commit -m "Camera Director v3: cerebro (camera-controller.js) + UI (ui-panel.js) desacoplados, split por player"
git push
```

(En especial `assets/ui-panel.js` y `camera-controller.js` hoy están **sin
trackear/renombrados** — sin ese `git add` no se suben y el plugin queda roto.)
