/* ============================================================================
 *  Camera Director — BRAIN  (camera-controller.js)
 *  (Slopsmith fetches it at the /screen.js URL, but plugin.json "script" points
 *   here — so the file name no longer clashes with highway_3d/screen.js.)
 *  ----------------------------------------------------------------------------
 *  This file is the stable "brain": it owns the camera bridge, per-player
 *  state, splitscreen routing, presets and persistence, and exposes a clean
 *  API on `window.__camDir`. It contains NO panel UI — the visual layer lives
 *  in `assets/ui-panel.js`, which this file loads at the end. That separation
 *  lets the UI be iterated/updated without touching this brain.
 *
 *  BRIDGE CONTRACT (consumed by the highway_3d renderer in its camUpdate())
 *  -----------------------------------------------------------------------
 *    window.__h3dCamCtl = { enabled, heightMul, distMul, yaw, pitch, panX, panY }
 *        The single, global camera. The current renderer reads ONLY this, so
 *        it is always kept pointing at the focused (or single) player's camera.
 *
 *    window.__h3dCamCtlPanels = { 0: camA, 1: camB, ... } | null
 *        Per-splitscreen-panel cameras. NULL when not split. A splitscreen-aware
 *        renderer prefers this, falling back to the global:
 *
 *            let fc = window.__h3dCamCtl;
 *            const ss = window.feedBackSplitscreen || window.slopsmithSplitscreen;
 *            if (ss && ss.isActive()) {
 *              const i = ss.panelIndexFor(highwayCanvas);
 *              const m = window.__h3dCamCtlPanels;
 *              if (i != null && m && m[i]) fc = m[i];
 *            }
 *
 *        The bundled highways (highway_3d / drum_highway_3d / keys_highway_3d)
 *        now consume this per-panel map (see DEVELOPERS.md), so each split panel
 *        renders its OWN camera. Renderers that don't read it fall back to the
 *        global (focused) camera.
 *
 *  API: window.__camDir  (the UI is the only consumer)
 *  --------------------------------------------------
 *    version, AXES, DEFAULTS, SLOT_COLORS
 *    clampAxis(k,v) · fmtAxis(k,v) · parseAxis(k,text)
 *    isSplit() · getMode() · getSlots() · getEditingKey() · setEditingKey(k)
 *    getColor(k) · getAxis(k) · setAxis(k,v) · isEnabled() · setEnabled(b)
 *    isLinkAll() · setLinkAll(b) · applyToAll() · setEnabledAll(b) · getAssignment(k)
 *    resetCamera() · listPresets() · savePreset(n) · updatePreset(n)
 *    deletePreset(n) · applyPreset(p) · exportPreset(p) · importFromFile(f)
 *    on(ev,fn) · off(ev,fn)   events: 'change'(slotKey) · 'mode' · 'presets'
 *    destroy()
 *
 *  Profiles are a single SHARED, named library (usable on any panel), with a
 *  per-panel `assignment` (which profile a panel is on, or null = Custom).
 *  Editing follows the focused splitscreen panel. Persisted at LS_STORE (v3),
 *  migrated from the v2 per-slot model.
 *
 *  Idempotent: re-injecting this script tears down the previous brain + UI.
 * ==========================================================================*/
(function () {
  'use strict';

  const PLUGIN_ID = 'camera_director';
  const ASSET_BASE = `/api/plugins/${PLUGIN_ID}/assets`;
  const VERSION = '3.3.2';

  const LS_STORE = 'camera_director.profiles.v3';  // { live, library, assignments, linkAll, active }
  const LS_PROFILES = 'camera_director.profiles.v2';  // legacy per-slot model (migrated → v3)
  const LS_LIVE = 'camera_director.live';        // legacy v1 (migrated → slot A live)
  const LS_PRESETS = 'camera_director.presets';  // legacy v1 (migrated → shared library)
  const EXPORT_KIND = 'slopsmith.camera-director.preset';
  const EXPORT_VERSION = 1;

  const AXES = [
    ['heightMul', 0.2, 3, 0.01],
    ['distMul', 0.3, 3, 0.01],
    ['yaw', -1.2, 1.2, 0.01],
    ['pitch', -120, 120, 1],
    ['panX', -200, 200, 1],
    ['panY', -200, 200, 1],
  ];
  const DEFAULTS = Object.freeze({
    enabled: false, heightMul: 1, distMul: 1, yaw: 0, pitch: 0, panX: 0, panY: 0,
  });
  // Player slots map 1:1 to splitscreen panel indices (A→0, B→1, C→2, D→3).
  const SLOT_KEYS = ['A', 'B', 'C', 'D'];
  const SLOT_COLORS = { A: '#4080e0', B: '#e8742c', C: '#3cc46b', D: '#b06cf0' };

  // Idempotent teardown of a previous mount (brain + its UI).
  if (window.__camDir && typeof window.__camDir.destroy === 'function') {
    try { window.__camDir.destroy(); } catch (e) { /* ignore */ }
  }

  // ── Pure helpers ────────────────────────────────────────────────────────────
  function clampAxis(key, v) {
    const s = AXES.find((a) => a[0] === key);
    if (!s) return Number(v) || 0;
    return Math.max(s[1], Math.min(s[2], Number(v) || 0));
  }
  function stripLive(o) {
    const out = { enabled: !!o.enabled };
    for (const [k] of AXES) out[k] = clampAxis(k, Number(o[k]) || 0);
    return out;
  }
  function fmtAxis(key, v) {
    if (key === 'yaw') return (v * 57.2958).toFixed(0) + '°';
    if (key === 'heightMul' || key === 'distMul') return v.toFixed(2) + '×';
    return v.toFixed(0);
  }
  function parseAxis(key, text) {
    const n = parseFloat(String(text).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n)) return null;
    if (key === 'yaw') return clampAxis('yaw', n / 57.2958);
    return clampAxis(key, n);
  }

  // ── Store (v3): per-slot live cameras + a SHARED named-profile library +
  //    per-panel assignments (which profile each panel is on). Persisted. ──────
  function profileCam(c) { const o = {}; for (const [a] of AXES) o[a] = clampAxis(a, (c && Number(c[a])) || DEFAULTS[a]); return o; }
  function loadStore() {
    const out = { active: 'A', live: {}, library: [], assignments: {}, linkAll: false, _v: 3 };
    for (const k of SLOT_KEYS) { out.live[k] = Object.assign({}, DEFAULTS); out.assignments[k] = null; }
    // Prefer v3.
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS_STORE) || 'null'); } catch (e) { /* corrupt */ }
    if (s && s.live && Array.isArray(s.library)) {
      out.active = SLOT_KEYS.includes(s.active) ? s.active : 'A';
      out.linkAll = !!s.linkAll;
      for (const k of SLOT_KEYS) {
        out.live[k] = Object.assign({}, DEFAULTS, s.live[k]);
        out.assignments[k] = (s.assignments && s.assignments[k]) || null;
      }
      out.library = s.library.filter((p) => p && p.name && p.cam)
        .map((p) => ({ name: p.name, cam: profileCam(p.cam), color: p.color || SLOT_COLORS.A, savedAt: p.savedAt || '' }));
      return out;
    }
    // Migrate v2 (per-slot live + per-slot presets) → v3.
    let v2 = null;
    try { v2 = JSON.parse(localStorage.getItem(LS_PROFILES) || 'null'); } catch (e) { /* corrupt */ }
    if (v2 && v2.players) {
      out.active = SLOT_KEYS.includes(v2.active) ? v2.active : 'A';
      out.linkAll = !!v2.linkAll;
      const byName = new Map();
      for (const k of SLOT_KEYS) {
        const p = v2.players[k] || {};
        out.live[k] = Object.assign({}, DEFAULTS, p.live || {});
        if (Array.isArray(p.presets)) for (const pr of p.presets) {
          if (pr && pr.name && pr.cam && !byName.has(pr.name)) {
            byName.set(pr.name, { name: pr.name, cam: profileCam(pr.cam), color: pr.color || SLOT_COLORS[k], savedAt: pr.savedAt || '' });
          }
        }
      }
      out.library = [...byName.values()];
      return out;
    }
    // Migrate v1 legacy (single live + flat presets) → slot A + shared library.
    try { const l = JSON.parse(localStorage.getItem(LS_LIVE) || 'null'); if (l) out.live.A = Object.assign({}, DEFAULTS, l); } catch (e) { /* ignore */ }
    try {
      const pr = JSON.parse(localStorage.getItem(LS_PRESETS) || 'null');
      if (Array.isArray(pr)) for (const p of pr) if (p && p.name && p.cam) out.library.push({ name: p.name, cam: profileCam(p.cam), color: p.color || SLOT_COLORS.A, savedAt: p.savedAt || '' });
    } catch (e) { /* ignore */ }
    return out;
  }
  const profiles = loadStore();
  let _saveT = 0;
  function saveProfiles() { try { localStorage.setItem(LS_STORE, JSON.stringify(profiles)); } catch (e) { /* quota */ } }
  function saveSoon() { clearTimeout(_saveT); _saveT = setTimeout(saveProfiles, 250); }

  // Live bridge object per slot — mutated IN PLACE so the renderer keeps reading
  // the same reference frame to frame.
  const bridges = {};
  for (const k of SLOT_KEYS) bridges[k] = Object.assign({}, DEFAULTS, profiles.live[k]);
  function persistSlot(k) { profiles.live[k] = stripLive(bridges[k]); saveSoon(); }

  // ── Splitscreen awareness ───────────────────────────────────────────────────
  function ss() { return window.slopsmithSplitscreen; }
  function isSplit() { try { return !!(ss() && ss().isActive && ss().isActive()); } catch (e) { return false; } }
  function panelCanvasByIndex() {
    const arr = [];
    if (!isSplit()) return arr;
    const o = ss();
    document.querySelectorAll('canvas').forEach((c) => {
      try { const i = o.panelIndexFor(c); if (i != null && i >= 0) arr[i] = c; } catch (e) { /* ignore */ }
    });
    return arr;
  }
  function panelCount() {
    if (!isSplit()) return 1;
    const n = panelCanvasByIndex().filter(Boolean).length;
    return Math.max(2, Math.min(SLOT_KEYS.length, n || 2));
  }
  function activeSlots() { return isSplit() ? SLOT_KEYS.slice(0, panelCount()) : ['A']; }
  function slotForCanvas(canvas) {
    if (!isSplit()) return 'A';
    try { const i = ss().panelIndexFor(canvas); if (i != null && i >= 0 && i < SLOT_KEYS.length) return SLOT_KEYS[i]; } catch (e) { /* ignore */ }
    return null;
  }
  // Resolve a panel slot from a POINT (clientX/Y). The 3D highways mount a 2D
  // overlay canvas ON TOP of the WebGL canvas; that overlay is the pointer target
  // and resolves to null via panelIndexFor — which is why click-drag-on-canvas
  // targeted no panel in splitscreen. Hit-test the panels' WebGL canvas rects
  // instead so the drag lands on whichever panel the pointer is over.
  function slotForPoint(x, y) {
    if (!isSplit()) return 'A';
    const arr = panelCanvasByIndex();
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i]; if (!c) continue;
      const r = c.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return SLOT_KEYS[i];
    }
    return null;
  }
  function focusedSlot() {
    if (!isSplit()) return 'A';
    const arr = panelCanvasByIndex();
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) { try { if (ss().isCanvasFocused(arr[i])) return SLOT_KEYS[i]; } catch (e) { /* ignore */ } }
    }
    return 'A';
  }

  // ── Bridge wiring ───────────────────────────────────────────────────────────
  function writeBridge() {
    if (isSplit()) {
      const slots = activeSlots();
      const map = {};
      slots.forEach((k, idx) => { map[idx] = bridges[k]; });
      window.__h3dCamCtlPanels = map;
      const fi = SLOT_KEYS.indexOf(focusedSlot());
      window.__h3dCamCtl = map[fi] || map[0] || bridges.A;
    } else {
      window.__h3dCamCtlPanels = null;
      window.__h3dCamCtl = bridges.A;
    }
  }

  // ── Editing slot (which player's controls the UI is showing) ────────────────
  let editingKey = activeSlots().includes(profiles.active) ? profiles.active : 'A';
  function editBridge() { return bridges[editingKey]; }

  // ── Link-all: one camera shared across every panel ──────────────────────────
  // When on, editing/dragging any panel mirrors its camera (all axes + enabled)
  // to every active panel, so you tweak once and it applies across the board.
  let linkAll = !!profiles.linkAll;
  function syncLink(srcK) {
    if (!linkAll || !isSplit()) return;
    const src = bridges[srcK];
    for (const k of activeSlots()) {
      if (k === srcK) continue;
      const d = bridges[k];
      d.enabled = src.enabled;
      for (const [a] of AXES) d[a] = src[a];
      profiles.assignments[k] = profiles.assignments[srcK];
      persistSlot(k); emit('change', k);
    }
  }
  // One-shot: copy the editing panel's camera (+ enabled + assignment) to every panel.
  function applyToAll() {
    if (!isSplit()) return;
    const src = bridges[editingKey];
    for (const k of activeSlots()) {
      if (k === editingKey) continue;
      const d = bridges[k];
      d.enabled = src.enabled;
      for (const [a] of AXES) d[a] = src[a];
      profiles.assignments[k] = profiles.assignments[editingKey];
      persistSlot(k); emit('change', k);
    }
    writeBridge(); emit('mode');
  }
  // Enable/disable every panel at once.
  function setEnabledAll(b) {
    for (const k of activeSlots()) { bridges[k].enabled = !!b; persistSlot(k); emit('change', k); }
    writeBridge();
  }

  // ── Tiny event bus ──────────────────────────────────────────────────────────
  const subs = {};
  function on(ev, fn) { (subs[ev] || (subs[ev] = [])).push(fn); }
  function off(ev, fn) { if (subs[ev]) subs[ev] = subs[ev].filter((f) => f !== fn); }
  function emit(ev, arg) { (subs[ev] || []).forEach((f) => { try { f(arg); } catch (e) { /* ignore */ } }); }

  // ── Tween (preset load / reset) on a given slot ─────────────────────────────
  let _raf = 0;
  function tween(k, target, dur = 0.55) {
    cancelAnimationFrame(_raf);
    const b = bridges[k];
    const from = {}; for (const [a] of AXES) from[a] = Number(b[a]) || 0;
    const start = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const step = (now) => {
      const p = Math.min(1, (now - start) / (dur * 1000));
      const e = ease(p);
      for (const [a] of AXES) { if (a in target) b[a] = from[a] + (target[a] - from[a]) * e; }
      syncLink(k);
      emit('change', k);
      if (p < 1) _raf = requestAnimationFrame(step); else persistSlot(k);
    };
    _raf = requestAnimationFrame(step);
  }

  // ── Shared named-profile library (usable on ANY panel) + per-panel assign ────
  // Profiles are a single global list (not per-slot): save one on Player 1, apply
  // it on Player 2. `profiles.assignments[k]` tracks which profile a panel is on
  // (or null = Custom, after a manual tweak).
  function listPresets() { return profiles.library; }
  function currentCam(k) { const cam = {}; for (const [a] of AXES) cam[a] = clampAxis(a, Number(bridges[k][a]) || 0); return cam; }
  function savePreset(name, k) {
    k = k || editingKey; name = String(name || '').trim(); if (!name) return;
    profiles.library = profiles.library.filter((p) => p.name !== name);
    profiles.library.push({ name, cam: currentCam(k), color: SLOT_COLORS[k], savedAt: new Date().toISOString() });
    profiles.assignments[k] = name;   // saving puts this panel ON the new profile
    saveProfiles(); emit('presets'); emit('mode');
  }
  function updatePreset(name, k) {
    k = k || editingKey;
    const i = profiles.library.findIndex((p) => p.name === name); if (i < 0) return;
    profiles.library[i] = { name, cam: currentCam(k), color: profiles.library[i].color || SLOT_COLORS[k], savedAt: new Date().toISOString() };
    profiles.assignments[k] = name;
    saveProfiles(); emit('presets'); emit('mode');
  }
  function deletePreset(name) {
    profiles.library = profiles.library.filter((p) => p.name !== name);
    for (const k of SLOT_KEYS) if (profiles.assignments[k] === name) profiles.assignments[k] = null;
    saveProfiles(); emit('presets'); emit('mode');
  }
  function applyPreset(preset, k) {
    k = k || editingKey; if (!preset || !preset.cam) return;
    bridges[k].enabled = true;
    profiles.assignments[k] = preset.name || null;   // set before tween so syncLink mirrors it
    const target = {}; for (const [a] of AXES) target[a] = clampAxis(a, Number(preset.cam[a]) || 0);
    tween(k, target); syncLink(k); emit('change', k); emit('mode'); persistSlot(k);
  }
  function resetCamera(k) {
    k = k || editingKey; profiles.assignments[k] = null;
    const target = {}; for (const [a] of AXES) target[a] = DEFAULTS[a]; tween(k, target); emit('mode');
  }

  function exportPreset(payload) {
    let body = payload;
    if (payload && payload.cam && !payload.kind) body = { kind: EXPORT_KIND, version: EXPORT_VERSION, preset: payload };
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = body.preset ? body.preset.name : 'camera-preset';
    a.href = url; a.download = `slopsmith-${String(base).replace(/[^\w.-]+/g, '_')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFromFile(file, k) {
    k = k || editingKey;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.kind !== EXPORT_KIND) throw 0;
      const inc = Array.isArray(data.presets) ? data.presets : (data.preset ? [data.preset] : []);
      if (!inc.length) throw 0;
      const byName = new Map(profiles.library.map((p) => [p.name, p]));
      for (const p of inc) {
        if (p && p.name && p.cam) byName.set(p.name, { name: p.name, cam: p.cam, color: p.color || SLOT_COLORS[k], savedAt: p.savedAt || new Date().toISOString() });
      }
      profiles.library = [...byName.values()];
      saveProfiles(); emit('presets');
      if (inc.length === 1) applyPreset(inc[0], k);
      return true;
    } catch (e) { return false; }
  }

  // ── Blender-style canvas navigation, routed to the panel under the pointer ──
  const domL = [];
  const addL = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); domL.push([el, ev, fn, opts]); };
  const overUI = (e) => e.target && e.target.closest && e.target.closest('#camdir-root');
  const isCanvas = (t) => t && (t.id === 'highway' || t.tagName === 'CANVAS');
  let drag = null;
  addL(window, 'pointerdown', (e) => {
    if (overUI(e) || !isCanvas(e.target)) return;
    const k = slotForPoint(e.clientX, e.clientY);
    if (!k || !bridges[k].enabled) return;
    drag = { k, x: e.clientX, y: e.clientY };
  });
  addL(window, 'pointermove', (e) => {
    if (!drag) return;
    const b = bridges[drag.k];
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (e.shiftKey) {
      b.panX = clampAxis('panX', (Number(b.panX) || 0) + dx * 0.5);
      b.panY = clampAxis('panY', (Number(b.panY) || 0) - dy * 0.5);
    } else if (e.ctrlKey) {
      b.distMul = clampAxis('distMul', (Number(b.distMul) || 1) * (1 + dy * 0.004));
    } else if (e.altKey) {
      b.heightMul = clampAxis('heightMul', (Number(b.heightMul) || 1) - dy * 0.004);
    } else {
      b.yaw = clampAxis('yaw', (Number(b.yaw) || 0) + dx * 0.005);
      b.pitch = clampAxis('pitch', (Number(b.pitch) || 0) - dy * 0.6);
    }
    profiles.assignments[drag.k] = null; syncLink(drag.k); emit('change', drag.k); saveSoon();
  });
  addL(window, 'pointerup', () => { if (drag) { persistSlot(drag.k); drag = null; } });
  addL(window, 'wheel', (e) => {
    if (overUI(e) || !isCanvas(e.target)) return;
    const k = slotForPoint(e.clientX, e.clientY);
    if (!k || !bridges[k].enabled) return;
    e.preventDefault();
    const b = bridges[k];
    b.distMul = clampAxis('distMul', (Number(b.distMul) || 1) * (1 + (e.deltaY > 0 ? 0.06 : -0.06)));
    profiles.assignments[k] = null; syncLink(k); emit('change', k); persistSlot(k);
  }, { passive: false });

  // ── Mode / focus reconciliation ─────────────────────────────────────────────
  let _lastSig = '';
  function modeSig() { return isSplit() ? 'split:' + activeSlots().join('') + ':' + focusedSlot() : 'single'; }
  function reconcile() {
    const sig = modeSig();
    if (sig === _lastSig) return;
    _lastSig = sig;
    // Editing follows the FOCUSED panel: clicking a splitscreen panel switches
    // the Camera Director's target (highlighted tab + profile dropdown + sliders)
    // to that panel. Tab clicks don't change focus, so sig is unchanged then and
    // this early-returns — the tab selection is preserved until focus moves.
    if (isSplit()) {
      const fk = focusedSlot();
      if (activeSlots().includes(fk)) { editingKey = fk; profiles.active = fk; }
    }
    if (!activeSlots().includes(editingKey)) editingKey = activeSlots()[0] || 'A';
    writeBridge();
    emit('mode');
  }
  const _pollT = setInterval(reconcile, 600);
  try { if (ss() && ss().onFocusChange) ss().onFocusChange(reconcile); } catch (e) { /* ignore */ }
  writeBridge();

  // ── Public API ──────────────────────────────────────────────────────────────
  window.__camDir = {
    version: VERSION,
    AXES, DEFAULTS, SLOT_COLORS,
    clampAxis, fmtAxis, parseAxis,
    isSplit, getMode: () => (isSplit() ? 'split' : 'single'),
    getSlots() { return activeSlots().map((k, idx) => ({ key: k, color: SLOT_COLORS[k], label: idx + 1, enabled: !!bridges[k].enabled })); },
    getEditingKey: () => editingKey,
    setEditingKey(k) { if (activeSlots().includes(k)) { editingKey = k; profiles.active = k; saveSoon(); emit('mode'); } },
    getColor: (k) => SLOT_COLORS[k || editingKey],
    getAxis: (key) => Number(editBridge()[key]) || 0,
    setAxis(key, val) { editBridge()[key] = clampAxis(key, val); profiles.assignments[editingKey] = null; syncLink(editingKey); emit('change', editingKey); persistSlot(editingKey); },
    getAssignment: (k) => profiles.assignments[k || editingKey] || null,
    isEnabled: () => !!editBridge().enabled,
    setEnabled(b) { editBridge().enabled = !!b; syncLink(editingKey); writeBridge(); emit('change', editingKey); persistSlot(editingKey); },
    // Link-all + bulk ops (splitscreen "across the board").
    isLinkAll: () => linkAll,
    setLinkAll(b) { linkAll = !!b; profiles.linkAll = linkAll; saveSoon(); if (linkAll) syncLink(editingKey); writeBridge(); emit('mode'); },
    applyToAll,
    setEnabledAll,
    resetCamera: () => resetCamera(editingKey),
    listPresets: () => listPresets(editingKey),
    savePreset: (n) => savePreset(n, editingKey),
    updatePreset: (n) => updatePreset(n, editingKey),
    deletePreset: (n) => deletePreset(n, editingKey),
    applyPreset: (p) => applyPreset(p, editingKey),
    exportPreset,
    importFromFile: (f) => importFromFile(f, editingKey),
    on, off,
    destroy() {
      clearInterval(_pollT); clearTimeout(_saveT); cancelAnimationFrame(_raf);
      try { if (ss() && ss().offFocusChange) ss().offFocusChange(reconcile); } catch (e) { /* ignore */ }
      for (const [el, ev, fn, opts] of domL) { try { el.removeEventListener(ev, fn, opts); } catch (e) { /* ignore */ } }
      domL.length = 0;
      try { window.__camDirUI && window.__camDirUI.destroy && window.__camDirUI.destroy(); } catch (e) { /* ignore */ }
      if (uiScript) { try { uiScript.remove(); } catch (e) { /* ignore */ } }
    },
  };

  // ── Load the UI layer (separate, independently updatable) ────────────────────
  const uiScript = document.createElement('script');
  uiScript.src = `${ASSET_BASE}/ui-panel.js?v=${encodeURIComponent(VERSION)}`;
  uiScript.dataset.camdirUi = '1';
  uiScript.onerror = () => console.warn('[camera_director] UI (ui-panel.js) failed to load');
  document.body.appendChild(uiScript);
})();
