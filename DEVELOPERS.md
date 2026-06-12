# 👩‍💻 Developer notes — making the camera bridge native

This document is for **Slopsmith / `highway_3d` maintainers** (and anyone
rebuilding the bridge for a new app version). It describes the exact change
Camera Director needs inside the highway renderer, so the `bridge/` folder of
this repo can eventually be deleted.

**TL;DR:** `highway_3d`'s `camUpdate()` applies its auto-framing and calls
`cam.position.set(...)` / `cam.lookAt(...)` every frame. The bridge inserts an
optional user-offset layer between "auto-framing computed" and "camera
written", driven by one global object: `window.__h3dCamCtl`. It is ~30 lines,
allocation-free, and a no-op when the object is absent or disabled.

## The contract

Camera Director (or any other camera tool) writes this object; the renderer
only ever **reads** it:

```js
window.__h3dCamCtl = {
  enabled,     // boolean — false/absent → renderer behaves 100% stock
  heightMul,   // height multiplier        (1 = stock)
  distMul,     // dolly / zoom multiplier  (1 = stock)
  yaw,         // orbit around the look target, radians (0 = stock)
  pitch,       // tilt offset, highway units (0 = stock)
  panX, panY   // look-target pan, highway units (0 = stock)
};
```

Design rules the implementation must keep:

- **Layered, not replaced.** The offsets apply ON TOP of the stock
  auto-framing, so note tracking, zoom-to-density and the self-correcting
  look-at keep working while the user orbits.
- **NaN-safe.** Every field is coerced with `Number.isFinite(x) ? x : neutral`
  before use — a malformed object must never feed NaN into `cam.position` or
  `cam.lookAt`.
- **Allocation-free.** It runs every frame: plain arithmetic on locals, no
  vectors/objects created.
- **Zero coupling.** The renderer never writes the object and never assumes the
  plugin exists. `window.__h3dCamCtl` undefined → exactly stock behaviour.

## The exact patch (against Slopsmith Desktop 0.2.9's `highway_3d/screen.js`)

Two hunks inside `camUpdate()`. First, where the camera position is written
(after the `_hMul` / `_dMul` framing multipliers and `shoulderOffset` are
computed):

```diff
             const shoulderOffset = (_leftyCached ? -1 : 1) * 10 * K;
-            cam.position.set(curX + shoulderOffset, h * _hMul, dist * _dMul);
+            let _camX = curX + shoulderOffset, _camY = h * _hMul, _camZ = dist * _dMul;
+            // ── Free-camera user tweaks (orbit / height / zoom / pan) ──
+            // Driven by the Camera Director plugin via window.__h3dCamCtl.
+            // Layered ON TOP of the auto-framing so note tracking still works.
+            // The bridge is read once into _freeCam and reused for both the
+            // position and the look-at transforms; every field is coerced to a
+            // finite number before use so a malformed object can never feed NaN
+            // into cam.position / cam.lookAt.
+            const _freeCam = window.__h3dCamCtl;
+            const _lookAtZ = -FOCUS_D * 0.35;
+            if (_freeCam && _freeCam.enabled) {
+                const _distMul = Number.isFinite(_freeCam.distMul) ? _freeCam.distMul : 1;
+                const _heightMul = Number.isFinite(_freeCam.heightMul) ? _freeCam.heightMul : 1;
+                const _yaw = Number.isFinite(_freeCam.yaw) ? _freeCam.yaw : 0;
+                const _tx = curX, _ty = curLookY, _tz = _lookAtZ; // look target
+                let _vx = _camX - _tx, _vy = _camY - _ty, _vz = _camZ - _tz;
+                _vx *= _distMul; _vy *= _distMul; _vz *= _distMul; // zoom (dolly)
+                _vy *= _heightMul;                                 // height
+                const _cy = Math.cos(_yaw), _sy = Math.sin(_yaw);  // orbit around Y
+                const _rx = _vx * _cy - _vz * _sy, _rz = _vx * _sy + _vz * _cy;
+                _camX = _tx + _rx; _camY = _ty + _vy; _camZ = _tz + _rz;
+            }
+            cam.position.set(_camX, _camY, _camZ);
```

Second, where the final look-at is written (after `curLookY` has been
self-corrected):

```diff
             curLookY += (tgtLookY - curLookY) * lerp;

-            // Final look-at with the corrected Y (overrides the tentative one above)
-            cam.lookAt(curX, curLookY, -FOCUS_D * 0.35);
+            // Final look-at with the corrected Y (overrides the tentative one above).
+            // User tilt (pitch) + pan offsets layer on top when the free-cam is
+            // enabled; each is coerced to a finite number to avoid a NaN look-at.
+            if (_freeCam && _freeCam.enabled) {
+                const _panX = Number.isFinite(_freeCam.panX) ? _freeCam.panX : 0;
+                const _panY = Number.isFinite(_freeCam.panY) ? _freeCam.panY : 0;
+                const _pitch = Number.isFinite(_freeCam.pitch) ? _freeCam.pitch : 0;
+                cam.lookAt(curX + _panX * K, curLookY + (_pitch + _panY) * K, _lookAtZ);
+            } else {
+                cam.lookAt(curX, curLookY, _lookAtZ);
+            }
```

How the math works, in order:

1. Take the **auto-framed** camera position and the look target
   (`curX, curLookY, -FOCUS_D * 0.35`).
2. Express the camera as a vector from the target, scale it by `distMul`
   (dolly) and additionally scale its Y by `heightMul` (height).
3. Rotate that vector around the Y axis by `yaw` (orbit) and re-add the
   target.
4. At look-at time, shift the target by `panX` / `panY` and add `pitch` to the
   target's Y — all in highway units (`K`).

## Upstreaming it

If you maintain `highway_3d`: applying the two hunks above (adapted to the
current source) is the entire feature. Suggestions:

- Keep the read in `camUpdate()` so the offsets compose with whatever
  auto-framing logic the renderer currently has — do not cache `enabled`
  outside the frame loop.
- The local naming (`_freeCam`, `_camX` …) is only to avoid collisions in the
  minified-ish 0.2.9 bundle; use whatever fits the source tree.
- No changes are needed anywhere else: no events, no API surface, no plugin
  dependency. The plugin discovers support purely by the camera responding.

With the read native, Camera Director works out of the box on every install
and this repo's `bridge/` folder (and its update-overwrites-the-patch caveat)
disappears.

## Rebuilding the bridge for a new app version

Until it's native, the patch must be rebuilt per app version:

1. Take the new bundled renderer:
   `<app resources>/slopsmith/plugins/highway_3d/screen.js`.
2. Locate `camUpdate()` — search for `cam.position.set(` and the final
   `cam.lookAt(`.
3. Re-apply the two hunks above around those two write points.
4. Verify in-app: panel opens (`` ` ``), Free camera ON, every slider responds,
   and with Free camera OFF the stock auto-camera is pixel-identical.
5. Replace `bridge/screen.js` with the result and update the version notes in
   `bridge/README.md` / `bridge/README.es.md`.

## Testing checklist

- [ ] `window.__h3dCamCtl` undefined → stock behaviour (no errors in console).
- [ ] `enabled: false` → stock behaviour.
- [ ] Each field individually NaN/garbage → treated as its neutral value.
- [ ] Orbit, height, zoom, tilt, pan all respond live while notes track.
- [ ] No per-frame allocation added (check with the performance profiler).
