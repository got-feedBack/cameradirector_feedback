# 🎥 Camera Director — plugin para Slopsmith

> 🇪🇸 Español · [🇬🇧 English](./README.md)

Un panel de control flotante y **bilingüe (EN/ES)** que te deja dirigir la cámara
del **3D Highway** en tiempo real — **Órbita, Paneo, Zoom, Inclinación y
Altura** — con **dos perfiles de jugador independientes** y una **biblioteca de
presets** que podés guardar, exportar e importar.

https://github.com/user-attachments/assets/ba1dbb92-be79-4a7b-9ecb-d4304089d3aa

## Funciones

- **Jugador 1 / Jugador 2** — un toggle arriba cambia entre dos perfiles, cada
  uno con su propia cámara en vivo **y** sus propios presets. El panel cambia de
  color para distinguirlos (azul = J1, ámbar = J2). **Tocá el número** para
  renombrar al jugador con lo que quieras.
- **Controles de cámara en vivo** — Altura, Zoom, Órbita, Inclinación,
  Pan X / Pan Y, y arrastrar para orbitar directo sobre el highway.
- **Presets** — un único lugar para **guardar**, **cargar**, **exportar** e
  **importar** vistas. Vienen dos de fábrica: **Default** (neutro) y
  **Rocksmith** (encuadre estilo clásico).
- **Compartible** — exportá un preset a un archivo `.json`; los demás lo importan
  y obtienen la vista exacta.
- **Chip inteligente** — el lanzador 🎥 solo aparece cuando hay una canción
  abierta **y** el 3D Highway es la visualización activa.
- **Estética Slopsmith** — panel de metal cepillado, con los colores de
  Slopsmith.

## Instalación

### Slopsmith 0.3+ — solo el plugin

Desde Slopsmith **0.3** en adelante el puente de cámara viene incluido en la app,
así que no hay nada más que hacer: poné este plugin en tu carpeta de plugins y
reiniciá.

| Plataforma | Carpeta de plugins |
|------------|--------------------|
| Windows    | `%APPDATA%\slopsmith-desktop\plugins\` |
| macOS      | `~/Library/Application Support/slopsmith-desktop/plugins/` |
| Linux      | `~/.config/slopsmith-desktop/plugins/` |

```powershell
# Windows (PowerShell) — cloná para que el Plugin Manager pueda actualizarlo
git clone https://github.com/nimuart/cameradirector_feedback "$env:APPDATA\slopsmith-desktop\plugins\camera_director"
```

Después **reiniciá Slopsmith**. El nombre de la carpeta no importa, pero el `id`
del manifiesto (`camera_director`) sí.

### Slopsmith 0.2.9 y anteriores — un paso extra

Estas versiones todavía no leen el puente, así que el panel abre pero la cámara
no se mueve hasta aplicar el parche incluido. Mirá **[INSTALACION.md](./INSTALACION.md)**
(o corré `bridge/install_modded_screen.bat` en Windows). Detalles en
[`bridge/`](./bridge/).

## Uso

1. Abrí una canción con la visualización **3D Highway** — aparece el chip 🎥.
2. Hacé clic (o apretá **`` ` ``**) y elegí **Jugador 1** o **Jugador 2**.
3. Activá **Cámara libre** y movés los sliders o el highway.
4. **Guardar preset** para conservar una vista; **Exportar** para compartirla.

Apagá **Cámara libre** para devolverle el control a la cámara automática de
Slopsmith.

## Formato de archivo de preset

```json
{
  "kind": "slopsmith.camera-director.preset",
  "version": 1,
  "preset": {
    "name": "Frente de escenario",
    "cam": { "heightMul": 1.2, "distMul": 0.9, "yaw": -0.3, "pitch": 14, "panX": 0, "panY": -8 }
  }
}
```

Las importaciones validan el marcador `kind` antes de aplicar, así que es seguro
intercambiar archivos.

## El puente (0.2.9 y anteriores)

Camera Director maneja el highway a través de un único objeto compartido,
`window.__h3dCamCtl`, que `highway_3d` lee en cada frame. En 0.2.9 y anteriores
la carpeta [`bridge/`](./bridge/) parchea el renderer para leerlo; desde 0.3 es
nativo. El cambio exacto (para mantenedores) está en
[DEVELOPERS.md](./DEVELOPERS.md).

## Licencia

AGPL-3.0-only, igual que Slopsmith.
