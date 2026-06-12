# Puente del highway (`__h3dCamCtl`)

> 🇪🇸 Español · [🇬🇧 English](./README.md)

Camera Director maneja la cámara del 3D Highway a través de un único objeto
compartido, `window.__h3dCamCtl`, que el renderer del highway lee en cada frame
dentro de su `camUpdate()`. El plugin `highway_3d` que viene con Slopsmith
Desktop (hasta la **0.2.9** inclusive) **no** incluye esa lectura todavía —
esta carpeta trae el renderer parcheado más los scripts de instalación y
restauración.

## Contenido

| Archivo | Función |
|---------|---------|
| `screen.js` | Renderer `highway_3d` parcheado (hecho sobre el bundle de Slopsmith Desktop **0.2.9**) que lee `window.__h3dCamCtl`. |
| `install_modded_screen.bat` | Instalador para Windows: hace backup del renderer original como `screen.js.bak` y copia `screen.js` en su lugar. |
| `restore_original_screen.bat` | Restauración para Windows: vuelve a poner el backup `screen.js.bak` y lo borra. |

## Instalación (Windows, ubicación por defecto)

1. Cerrá Slopsmith por completo.
2. Doble clic en `install_modded_screen.bat` y aceptá el aviso de
   administrador.
3. Abrí Slopsmith — Camera Director ya puede mover la cámara.

El script apunta a la ruta de instalación por defecto:

```
C:\Program Files\Slopsmith\current\resources\slopsmith\plugins\highway_3d\screen.js
```

Si Slopsmith está instalado en otro lado, editá la línea `TARGET` del `.bat`, o
hacé la copia a mano.

## Instalación (manual / macOS / Linux)

Con Slopsmith cerrado:

1. Encontrá el renderer del highway bundleado:
   `<recursos de la app>/slopsmith/plugins/highway_3d/screen.js`
2. Hacele backup (por ejemplo, renombrá una copia a `screen.js.bak`).
3. Reemplazalo por el `screen.js` de esta carpeta.

## Desinstalación

Ejecutá `restore_original_screen.bat` (Windows), o restaurá tu backup
manual.

## ⚠️ Notas de versión

- El archivo parcheado corresponde a **Slopsmith Desktop 0.2.9**. Aplicarlo en
  otra versión puede romper el highway — en otras versiones, mejor un parche
  hecho sobre el renderer de esa versión.
- **Cada actualización de la app pisa el parche** (el actualizador reemplaza el
  `highway_3d` bundleado). Volvé a correr el instalador después de actualizar.
- La solución limpia a largo plazo es que la lectura de `__h3dCamCtl` se
  integre upstream en el `highway_3d` de Slopsmith, lo que haría innecesaria
  esta carpeta. El parche exacto y la guía para integrarlo están en
  [DEVELOPERS.md](../DEVELOPERS.md) (en inglés).

## Licencia

El `screen.js` parcheado es una copia modificada del renderer `highway_3d` de
Slopsmith y mantiene la licencia de Slopsmith (AGPL-3.0), igual que este
plugin.
