/* ============================================================================
 *  Camera Director — BRAIN  (camera-controller.js)
 *  (Slopsmith fetches it at the /screen.js URL, but plugin.json "script" points
 *   here — so the file name no longer clashes with highway_3d/screen.js.)
 *  ----------------------------------------------------------------------------
 *  This file is the stable "brain": it owns the camera bridge, per-PANEL state,
 *  splitscreen routing, presets and persistence, and exposes a clean API on
 *  `window.__camDir`. It contains NO panel UI — the visual layer lives in
 *  `assets/ui-panel.js`, which this file loads at the end. That separation lets
 *  the UI be iterated/updated without touching this brain.
 *
 *  PANELS ARE KEYED BY NAME (not fixed A–D slots)
 *  ----------------------------------------------
 *  Splitscreen panels are user-nameable and a popped-out panel can itself split
 *  into more panels, so the old 4-slot model doesn't scale. Cameras, assignments
 *  and the edit target are now keyed by the panel's NAME (from the splitscreen
 *  API's `getPanels()`), while the highways still read a per-INDEX map — so
 *  `writeBridge()` maps each active panel index → its name → its live camera.
 *
 *  BRIDGE CONTRACT (consumed by the highway_3d renderer in its camUpdate())
 *  -----------------------------------------------------------------------
 *    window.__h3dCamCtl = { enabled, heightMul, distMul, yaw, pitch, panX, panY }
 *        The single, global camera. Renderers that don't read the per-panel map
 *        read ONLY this, so it is kept pointing at the focused player's camera.
 *
 *    window.__h3dCamCtlPanels = { 0: camA, 1: camB, ... } | null
 *        Per-splitscreen-panel cameras BY INDEX. NULL when not split. A
 *        splitscreen-aware renderer prefers this, falling back to the global:
 *
 *            let fc = window.__h3dCamCtl;
 *            const ss = window.feedBackSplitscreen || window.slopsmithSplitscreen;
 *            if (ss && ss.isActive()) {
 *              const i = ss.panelIndexFor(highwayCanvas);
 *              const m = window.__h3dCamCtlPanels;
 *              if (i != null && m && m[i]) fc = m[i];
 *            }
 *
 *  API: window.__camDir  (the UI is the only consumer)
 *  --------------------------------------------------
 *    version, AXES, DEFAULTS, PANEL_COLORS
 *    clampAxis(k,v) · fmtAxis(k,v) · parseAxis(k,text)
 *    isSplit() · getMode() · getSlots() · getEditingKey() · setEditingKey(name)
 *    getColor(name) · getAxis(k) · setAxis(k,v) · isEnabled() · setEnabled(b)
 *    isLinkAll() · setLinkAll(b) · applyToAll() · setEnabledAll(b) · getAssignment(name)
 *    resetCamera() · listPresets() · savePreset(n) · updatePreset(n)
 *    deletePreset(n) · applyPreset(p) · exportPreset(p) · importFromFile(f)
 *    on(ev,fn) · off(ev,fn)   events: 'change'(panelName) · 'mode' · 'presets'
 *    destroy()
 *
 *  Profiles are a single SHARED, named library (usable on any panel), with a
 *  per-panel `assignment` (which profile a panel is on, or null = Custom).
 *  Editing follows the focused splitscreen panel. Persisted at LS_STORE (v4,
 *  name-keyed), migrated from the v3 per-slot model (and v2/v1 before it).
 *
 *  Idempotent: re-injecting this script tears down the previous brain + UI.
 * ==========================================================================*/
(function () {
  'use strict';

  const PLUGIN_ID = 'camera_director';
  const ASSET_BASE = `/api/plugins/${PLUGIN_ID}/assets`;
  const VERSION = '3.4.0';

  const LS_STORE = 'camera_director.profiles.v3';  // v3+v4 both live here (see _v); { live, library, assignments, linkAll, active }
  const LS_PROFILES = 'camera_director.profiles.v2';  // legacy per-slot model
  const LS_LIVE = 'camera_director.live';        // legacy v1
  const LS_PRESETS = 'camera_director.presets';  // legacy v1
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
  // Panel accent colors, assigned by panel INDEX (names are arbitrary, so color
  // tracks position). Wraps past 8 panels.
  const PANEL_COLORS = ['#4080e0', '#e8742c', '#3cc46b', '#b06cf0', '#e0c040', '#40c0c0', '#e06090', '#90a0b0'];
  function colorForIndex(i) { const n = PANEL_COLORS.length; return PANEL_COLORS[(((i | 0) % n) + n) % n]; }
  // Name used for the single (non-split) main view — its own persisted camera.
  const SINGLE_NAME = 'Main';

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
  function profileCam(c) { const o = {}; for (const [a] of AXES) o[a] = clampAxis(a, (c && Number(c[a])) || DEFAULTS[a]); return o; }

  // ── Follower (popped-out) window: splitscreen-aware, read-only camera agent ──
  // A popped-out panel runs the whole app in a separate window (`?ssFollower=1&
  // popupId=&panelIndex=N&name=`). It NEVER edits the store — it (a) APPLIES its
  // panel(s)' cameras, resolved by NAME from the shared store and kept live by
  // the main window's `{type:'camdir',cams}` broadcasts + `storage` events, and
  // (b) REPORTS its panel names to main (`{type:'camdir-panels',windowId,names}`)
  // so main's selector can list and steer them ("steer everything from main").
  // A follower can itself split, so its panels come from the splitscreen API when
  // active, else the single URL panel. Identity = popupId (stable per window).
  (function maybeFollower() {
    let params; try { params = new URLSearchParams(location.search); } catch (e) { return; }
    if (params.get('ssFollower') !== '1') return;
    const pi = parseInt(params.get('panelIndex'), 10);
    const WIN = params.get('popupId') || ('follower-' + ((pi >= 0 ? pi : 0)));
    const URL_NAME = (params.get('name') || '').trim() || ('P' + ((pi >= 0 ? pi : 0) + 1));
    const CH_NAME = 'slopsmith-ss';
    const ssf = () => window.feedBackSplitscreen || window.slopsmithSplitscreen;
    const clampAll = (c) => Object.assign({}, DEFAULTS, c || {});
    let live = {};   // name -> cam, from the shared store + main's broadcasts
    function loadLive() { try { const s = JSON.parse(localStorage.getItem(LS_STORE) || 'null'); if (s && s.live) live = s.live; } catch (e) { /* ignore */ } }
    // This follower's panels: the splitscreen API when it has split, else the
    // single popped panel named by the pop-out URL.
    function localPanels() {
      const o = ssf();
      try {
        if (o && o.isActive && o.isActive() && o.getPanels) {
          const g = o.getPanels() || [];
          if (g.length) return g.map((p) => ({ index: p.index, name: p.name || ('P' + (p.index + 1)), focused: !!p.focused, canvas: p.canvas || null }));
        }
      } catch (e) { /* ignore */ }
      return [{ index: 0, name: URL_NAME, focused: true, canvas: null }];
    }
    function applyAll() {
      const ps = localPanels();
      const map = {}; let foc = null;
      ps.forEach((p) => { const c = clampAll(live[p.name]); map[p.index] = c; if (p.focused || foc === null) foc = c; });
      window.__h3dCamCtlPanels = map;      // per-panel by local index
      window.__h3dCamCtl = foc || clampAll(null);   // focused / single
    }
    let ch = null;
    const names = () => localPanels().map((p) => p.name);
    const announce = () => { try { if (ch) ch.postMessage({ type: 'camdir-panels', windowId: WIN, names: names() }); } catch (e) { /* ignore */ } };
    loadLive(); applyAll();
    try {
      if (typeof BroadcastChannel === 'function') {
        ch = new BroadcastChannel(CH_NAME);
        ch.addEventListener('message', (ev) => {
          const m = ev.data || {};
          if (m.type === 'camdir' && m.cams) { for (const n in m.cams) live[n] = m.cams[n]; applyAll(); }
          else if (m.type === 'camdir-who') announce();   // main soliciting panel lists
        });
        try { ch.postMessage({ type: 'camdir-hello' }); } catch (e) { /* nudge main to send cams */ }
        announce();
      }
    } catch (e) { /* ignore */ }
    // Cross-window persistence (storage fires in OTHER windows).
    const onStorage = (e) => { if (e.key !== LS_STORE || !e.newValue) return; try { const s = JSON.parse(e.newValue); if (s && s.live) { live = s.live; applyAll(); } } catch (err) { /* ignore */ } };
    window.addEventListener('storage', onStorage);
    // Re-apply + heartbeat-announce (main prunes stale follower entries); the
    // follower's own layout can change (it may split), so re-announce on change.
    const poll = setInterval(() => { applyAll(); announce(); }, 1000);
    const onPanels = () => { applyAll(); announce(); };
    try { if (window.feedBack && window.feedBack.on) window.feedBack.on('splitscreen:panels-changed', onPanels); } catch (e) { /* ignore */ }

    // ── Direct free-camera mouse control in the follower window ──────────────
    // The follower is otherwise read-only, but the user expects to orbit/pan/
    // zoom its own panels by dragging on the canvas (same Blender-nav as main).
    // To keep MAIN the single store-writer (no cross-window race), the follower
    // edits its LOCAL applied camera for instant feedback and forwards the result
    // to main as {type:'camdir-edit'} — main clamps, persists, and rebroadcasts.
    const fAxis = {}; for (const a of AXES) fAxis[a[0]] = a;
    const fclamp = (k, v) => { const s = fAxis[k]; if (!s) return Number(v) || 0; return Math.max(s[1], Math.min(s[2], Number(v) || 0)); };
    const stripF = (c) => { const o = { enabled: !!c.enabled }; for (const a of AXES) o[a[0]] = fclamp(a[0], Number(c[a[0]]) || 0); return o; };
    const fIsCanvas = (t) => t && (t.id === 'highway' || t.tagName === 'CANVAS');
    const fOverUI = (e) => e.target && e.target.closest && e.target.closest('#camdir-root');
    function panelForPoint(x, y) {
      const ps = localPanels();
      for (const p of ps) {
        if (!p.canvas || !p.canvas.getBoundingClientRect) continue;
        const r = p.canvas.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return p;
      }
      // Single-panel follower (no per-panel canvas): the whole window is it.
      if (ps.length === 1 && !ps[0].canvas) return ps[0];
      return null;
    }
    let _lastSend = 0;
    function sendEdit(name, cam, force) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      if (!force && now - _lastSend < 50) return;   // throttle live drag
      _lastSend = now;
      try { if (ch) ch.postMessage({ type: 'camdir-edit', windowId: WIN, name, cam: stripF(cam) }); } catch (e) { /* ignore */ }
    }
    let fdrag = null;
    const fL = [];
    const fAdd = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); fL.push([el, ev, fn, opts]); };
    fAdd(window, 'pointerdown', (e) => {
      if (fOverUI(e) || !fIsCanvas(e.target)) return;
      const p = panelForPoint(e.clientX, e.clientY); if (!p) return;
      const cam = live[p.name]; if (!cam || !cam.enabled) return;   // free-cam must be armed (from main)
      fdrag = { name: p.name, x: e.clientX, y: e.clientY };
    });
    fAdd(window, 'pointermove', (e) => {
      if (!fdrag) return;
      const b = Object.assign({}, DEFAULTS, live[fdrag.name]);   // work on a copy
      const dx = e.clientX - fdrag.x, dy = e.clientY - fdrag.y; fdrag.x = e.clientX; fdrag.y = e.clientY;
      if (e.shiftKey) {
        b.panX = fclamp('panX', (Number(b.panX) || 0) + dx * 0.5);
        b.panY = fclamp('panY', (Number(b.panY) || 0) - dy * 0.5);
      } else if (e.ctrlKey) {
        b.distMul = fclamp('distMul', (Number(b.distMul) || 1) * (1 + dy * 0.004));
      } else if (e.altKey) {
        b.heightMul = fclamp('heightMul', (Number(b.heightMul) || 1) - dy * 0.004);
      } else {
        b.yaw = fclamp('yaw', (Number(b.yaw) || 0) + dx * 0.005);
        b.pitch = fclamp('pitch', (Number(b.pitch) || 0) - dy * 0.6);
      }
      live[fdrag.name] = b; applyAll(); sendEdit(fdrag.name, b, false);
    });
    fAdd(window, 'pointerup', () => { if (fdrag) { sendEdit(fdrag.name, live[fdrag.name], true); fdrag = null; } });
    fAdd(window, 'wheel', (e) => {
      if (fOverUI(e) || !fIsCanvas(e.target)) return;
      const p = panelForPoint(e.clientX, e.clientY); if (!p) return;
      const cam = live[p.name]; if (!cam || !cam.enabled) return;
      e.preventDefault();
      const b = Object.assign({}, DEFAULTS, cam);
      b.distMul = fclamp('distMul', (Number(b.distMul) || 1) * (1 + (e.deltaY > 0 ? 0.06 : -0.06)));
      live[p.name] = b; applyAll(); sendEdit(p.name, b, true);
    }, { passive: false });

    window.__camDir = {
      version: VERSION, isFollower: true, windowId: WIN,
      destroy() {
        clearInterval(poll);
        try { if (window.feedBack && window.feedBack.off) window.feedBack.off('splitscreen:panels-changed', onPanels); } catch (e) { /* ignore */ }
        for (const [el, ev, fn, opts] of fL) { try { el.removeEventListener(ev, fn, opts); } catch (e) { /* ignore */ } }
        try { if (ch) ch.close(); } catch (e) { /* ignore */ }
        window.removeEventListener('storage', onStorage);
      },
    };
    window.__camDir.__followerHandled = true;
  })();
  if (window.__camDir && window.__camDir.__followerHandled) return;

  // ── Store (v4): per-panel-NAME live cameras + a SHARED named-profile library +
  //    per-panel-NAME assignments (which profile each panel is on). Persisted. ─
  //    Migrated from v3 (slot-keyed): the slot cameras/assignments are stashed
  //    by index (_legacyLive/_legacyAssign) and adopted the first time a panel
  //    appears at that index, so existing per-panel cameras survive the rename.
  function loadStore() {
    const out = { active: null, live: {}, library: [], assignments: {}, linkAll: false, _v: 4, _legacyLive: [], _legacyAssign: [] };
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS_STORE) || 'null'); } catch (e) { /* corrupt */ }
    // v4 (name-keyed) — load as-is.
    if (s && s._v === 4 && s.live && Array.isArray(s.library)) {
      out.active = (typeof s.active === 'string') ? s.active : null;
      out.linkAll = !!s.linkAll;
      for (const n in s.live) out.live[n] = Object.assign({}, DEFAULTS, s.live[n]);
      out.assignments = {}; for (const n in (s.assignments || {})) out.assignments[n] = s.assignments[n] || null;
      out.library = s.library.filter((p) => p && p.name && p.cam)
        .map((p) => ({ name: p.name, cam: profileCam(p.cam), color: p.color || PANEL_COLORS[0], savedAt: p.savedAt || '' }));
      return out;
    }
    // v3 (slot-keyed live + shared library) → v4. Keep the library; stash slot
    // cameras/assignments by index for adoption-on-first-appearance.
    const SK = ['A', 'B', 'C', 'D'];
    if (s && s.live && Array.isArray(s.library)) {
      out.linkAll = !!s.linkAll;
      out.library = s.library.filter((p) => p && p.name && p.cam)
        .map((p) => ({ name: p.name, cam: profileCam(p.cam), color: p.color || PANEL_COLORS[0], savedAt: p.savedAt || '' }));
      out._legacyLive = SK.map((k) => (s.live[k] ? Object.assign({}, DEFAULTS, s.live[k]) : null));
      out._legacyAssign = SK.map((k) => ((s.assignments && s.assignments[k]) || null));
      return out;
    }
    // v2 (per-slot live + per-slot presets) → v4.
    let v2 = null;
    try { v2 = JSON.parse(localStorage.getItem(LS_PROFILES) || 'null'); } catch (e) { /* corrupt */ }
    if (v2 && v2.players) {
      out.linkAll = !!v2.linkAll;
      const byName = new Map();
      out._legacyLive = SK.map((k) => {
        const p = v2.players[k] || {};
        if (Array.isArray(p.presets)) for (const pr of p.presets) {
          if (pr && pr.name && pr.cam && !byName.has(pr.name)) byName.set(pr.name, { name: pr.name, cam: profileCam(pr.cam), color: pr.color || colorForIndex(SK.indexOf(k)), savedAt: pr.savedAt || '' });
        }
        return p.live ? Object.assign({}, DEFAULTS, p.live) : null;
      });
      out.library = [...byName.values()];
      return out;
    }
    // v1 legacy (single live + flat presets) → SINGLE live + shared library.
    try { const l = JSON.parse(localStorage.getItem(LS_LIVE) || 'null'); if (l) out.live[SINGLE_NAME] = Object.assign({}, DEFAULTS, l); } catch (e) { /* ignore */ }
    try {
      const pr = JSON.parse(localStorage.getItem(LS_PRESETS) || 'null');
      if (Array.isArray(pr)) for (const p of pr) if (p && p.name && p.cam) out.library.push({ name: p.name, cam: profileCam(p.cam), color: p.color || PANEL_COLORS[0], savedAt: p.savedAt || '' });
    } catch (e) { /* ignore */ }
    return out;
  }
  const profiles = loadStore();
  let _saveT = 0;
  function saveProfiles() {
    // Persist only the durable fields (drop the _legacy* migration scratch).
    try {
      localStorage.setItem(LS_STORE, JSON.stringify({
        _v: 4, active: profiles.active, live: profiles.live,
        library: profiles.library, assignments: profiles.assignments, linkAll: profiles.linkAll,
      }));
    } catch (e) { /* quota */ }
  }
  function saveSoon() { clearTimeout(_saveT); _saveT = setTimeout(saveProfiles, 250); }

  // ── Live bridge objects, keyed by panel NAME, created lazily and mutated IN
  //    PLACE so the renderer keeps reading the same reference frame to frame. ──
  const bridges = {};
  const _legacyUsed = new Set();
  function ensureBridge(name, index) {
    if (!bridges[name]) {
      let seed = profiles.live[name];
      if (!seed && index != null && profiles._legacyLive && profiles._legacyLive[index] && !_legacyUsed.has(index)) {
        seed = profiles._legacyLive[index];
        if (profiles._legacyAssign && profiles._legacyAssign[index] && profiles.assignments[name] == null) {
          profiles.assignments[name] = profiles._legacyAssign[index];
        }
        _legacyUsed.add(index);
      }
      bridges[name] = Object.assign({}, DEFAULTS, seed || {});
      profiles.live[name] = stripLive(bridges[name]);
    }
    return bridges[name];
  }
  function persistName(name) { if (bridges[name]) profiles.live[name] = stripLive(bridges[name]); saveSoon(); }

  // ── Splitscreen awareness (panels identified by NAME via getPanels) ─────────
  function ss() { return window.feedBackSplitscreen || window.slopsmithSplitscreen; }
  function isSplit() { try { return !!(ss() && ss().isActive && ss().isActive()); } catch (e) { return false; } }
  // Canonical panel list for THIS window: [{ index, name, canvas, focused }].
  // Single (non-split) mode → one synthetic 'Main' panel.
  function getPanelList() {
    if (!isSplit()) return [{ index: 0, name: SINGLE_NAME, canvas: null, focused: true }];
    const o = ss();
    let arr = [];
    try { arr = (o.getPanels && o.getPanels()) || []; } catch (e) { arr = []; }
    if (arr.length) {
      return arr.map((p) => ({ index: p.index, name: (p.name || ('P' + (p.index + 1))), canvas: p.canvas || null, focused: !!p.focused }));
    }
    // Fallback for an older splitscreen without getPanels(): enumerate canvases.
    const out = [];
    document.querySelectorAll('canvas').forEach((c) => {
      try { const i = o.panelIndexFor(c); if (i != null && i >= 0) out[i] = { index: i, name: 'P' + (i + 1), canvas: c, focused: false }; } catch (e) { /* ignore */ }
    });
    const list = out.filter(Boolean);
    if (list.length) { let f = false; for (const p of list) { try { if (ss().isCanvasFocused(p.canvas)) { p.focused = true; f = true; break; } } catch (e) { /* ignore */ } } if (!f) list[0].focused = true; }
    return list.length ? list : [{ index: 0, name: SINGLE_NAME, canvas: null, focused: true }];
  }
  function currentPanelNames() { return getPanelList().map((p) => p.name); }
  function focusedName() { const ps = getPanelList(); const f = ps.find((p) => p.focused); return (f || ps[0] || {}).name || SINGLE_NAME; }
  // Local panel index for a name, or null if the name isn't tiled in THIS window
  // (e.g. a popped-out/remote panel main is steering by name only).
  function indexForName(name) { const p = getPanelList().find((x) => x.name === name); return p ? p.index : null; }
  function colorForName(name) { return colorForIndex(indexForName(name)); }
  // Resolve a panel NAME from a POINT (clientX/Y). The 3D highways mount a 2D
  // overlay canvas ON TOP of the WebGL canvas; that overlay is the pointer target
  // and resolves to null via panelIndexFor — which is why click-drag-on-canvas
  // targeted no panel in splitscreen. Hit-test the panels' WebGL canvas rects.
  function nameForPoint(x, y) {
    if (!isSplit()) return SINGLE_NAME;
    for (const p of getPanelList()) {
      const c = p.canvas; if (!c) continue;
      const r = c.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return p.name;
    }
    return null;
  }

  // ── Bridge wiring ───────────────────────────────────────────────────────────
  function writeBridge() {
    if (isSplit()) {
      const panels = getPanelList();
      const map = {};
      panels.forEach((p) => { map[p.index] = ensureBridge(p.name, p.index); });
      window.__h3dCamCtlPanels = map;
      const foc = panels.find((p) => p.focused) || panels[0];
      window.__h3dCamCtl = (foc && map[foc.index]) || Object.assign({}, DEFAULTS);
    } else {
      window.__h3dCamCtlPanels = null;
      window.__h3dCamCtl = ensureBridge(SINGLE_NAME, 0);
    }
    broadcastSoon();
  }

  // ── Cross-window aggregation: steer popped-out panels from THIS (main) window ─
  // Followers (separate windows) can't read this window's globals, so we push
  // EVERY known panel camera BY NAME over BroadcastChannel('slopsmith-ss') — not
  // just this window's tiled panels — so a follower hosting a name main doesn't
  // tile still receives its camera. In return, followers announce their panel
  // names (`camdir-panels`) so main can list + steer them. Popped-out panels are
  // tracked per follower window and pruned on close/dock or staleness.
  let _camCh = null;
  const remotePanels = new Map();   // windowId → { names:[…], ts }
  const _nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
  function remoteNames() {
    const seen = new Set(); const out = [];
    for (const v of remotePanels.values()) for (const n of (v.names || [])) if (!seen.has(n)) { seen.add(n); out.push(n); }
    return out;
  }
  function pruneRemotes() {
    const now = _nowMs(); let changed = false;
    for (const [wid, v] of remotePanels) if (now - v.ts > 3000) { remotePanels.delete(wid); changed = true; }
    if (changed) emit('mode');
  }
  function camChannel() {
    if (!_camCh && typeof BroadcastChannel === 'function') {
      try {
        // SHARED channel: this is splitscreen's own BroadcastChannel — we ride it
        // to read its `closed`/`docked` follower-lifecycle messages and to reach
        // follower windows. Coexistence relies on each side ignoring the other's
        // message `type`s. The name must stay in sync with splitscreen (and the
        // follower's CH_NAME above); if splitscreen renames it, steering breaks.
        _camCh = new BroadcastChannel('slopsmith-ss');
        _camCh.addEventListener('message', (ev) => {
          const m = ev.data || {};
          if (m.type === 'camdir-hello') { broadcastCams(); requestRemotePanels(); }
          else if (m.type === 'camdir-panels' && m.windowId) {
            // Heartbeat lands every ~1s; only rebuild main's UI when the reported
            // set actually changed (else a slider drag would be interrupted).
            const next = Array.isArray(m.names) ? m.names.slice() : [];
            const prev = remotePanels.get(m.windowId);
            const changed = !prev || prev.names.join('') !== next.join('');
            remotePanels.set(m.windowId, { names: next, ts: _nowMs() });
            if (changed) { emit('mode'); broadcastCams(); }
          } else if (m.type === 'camdir-edit' && m.name && m.cam) {
            // A follower dragged its own panel's camera and forwarded the result.
            // Main is the sole store-writer: clamp, persist, rebroadcast so every
            // window (and the main UI, if it's the edited panel) converges.
            const b = ensureBridge(m.name, indexForName(m.name));
            b.enabled = !!m.cam.enabled;
            for (const [a] of AXES) if (a in m.cam) b[a] = clampAxis(a, Number(m.cam[a]) || 0);
            profiles.assignments[m.name] = null;   // manual tweak → Custom
            persistName(m.name);
            if (m.name === editingName) emit('change', m.name);
            broadcastSoon();
          } else if ((m.type === 'closed' || m.type === 'docked') && m.popupId) {
            // splitscreen's own follower lifecycle messages — a popped panel that
            // closed or re-docked is no longer steered remotely.
            if (remotePanels.delete(m.popupId)) emit('mode');
          }
        });
      } catch (e) { _camCh = null; }
    }
    return _camCh;
  }
  function requestRemotePanels() { const ch = camChannel(); if (ch) { try { ch.postMessage({ type: 'camdir-who' }); } catch (e) { /* ignore */ } } }
  function broadcastCams() {
    const ch = camChannel(); if (!ch) return;
    for (const p of getPanelList()) profiles.live[p.name] = stripLive(ensureBridge(p.name, p.index)); // refresh this window's panels
    const cams = {};
    for (const n in profiles.live) cams[n] = stripLive(profiles.live[n]);
    try { ch.postMessage({ type: 'camdir', cams }); } catch (e) { /* ignore */ }
  }
  let _bcT = 0;
  function broadcastSoon() { if (_bcT) return; _bcT = setTimeout(() => { _bcT = 0; broadcastCams(); }, 60); }

  // ── Editing panel (which panel's controls the UI is showing) ─────────────────
  let editingName = (typeof profiles.active === 'string' && profiles.active) || SINGLE_NAME;
  function editBridge() { return ensureBridge(editingName, indexForName(editingName)); }

  // ── Link-all: one camera shared across every panel ──────────────────────────
  let linkAll = !!profiles.linkAll;
  function syncLink(srcName) {
    if (!linkAll || !isSplit()) return;
    if (!currentPanelNames().includes(srcName)) return;   // remote-panel edits don't mirror into local panels
    const src = bridges[srcName]; if (!src) return;
    for (const p of getPanelList()) {
      if (p.name === srcName) continue;
      const d = ensureBridge(p.name, p.index);
      d.enabled = src.enabled;
      for (const [a] of AXES) d[a] = src[a];
      profiles.assignments[p.name] = profiles.assignments[srcName] || null;
      persistName(p.name); emit('change', p.name);
    }
  }
  // One-shot: copy the editing panel's camera (+ enabled + assignment) to all.
  function applyToAll() {
    if (!isSplit()) return;
    const src = ensureBridge(editingName, indexForName(editingName));
    for (const p of getPanelList()) {
      if (p.name === editingName) continue;
      const d = ensureBridge(p.name, p.index);
      d.enabled = src.enabled;
      for (const [a] of AXES) d[a] = src[a];
      profiles.assignments[p.name] = profiles.assignments[editingName] || null;
      persistName(p.name); emit('change', p.name);
    }
    writeBridge(); emit('mode');
  }
  // Enable/disable every panel at once.
  function setEnabledAll(b) {
    for (const p of getPanelList()) { ensureBridge(p.name, p.index).enabled = !!b; persistName(p.name); emit('change', p.name); }
    writeBridge();
  }

  // ── Tiny event bus ──────────────────────────────────────────────────────────
  const subs = {};
  function on(ev, fn) { (subs[ev] || (subs[ev] = [])).push(fn); }
  function off(ev, fn) { if (subs[ev]) subs[ev] = subs[ev].filter((f) => f !== fn); }
  function emit(ev, arg) { (subs[ev] || []).forEach((f) => { try { f(arg); } catch (e) { /* ignore */ } }); }

  // ── Tween (preset load / reset) on a given panel ────────────────────────────
  let _raf = 0;
  function tween(name, target, dur = 0.55) {
    cancelAnimationFrame(_raf);
    const b = ensureBridge(name, indexForName(name));
    const from = {}; for (const [a] of AXES) from[a] = Number(b[a]) || 0;
    const start = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const step = (now) => {
      const p = Math.min(1, (now - start) / (dur * 1000));
      const e = ease(p);
      for (const [a] of AXES) { if (a in target) b[a] = from[a] + (target[a] - from[a]) * e; }
      syncLink(name);
      emit('change', name);
      if (p < 1) _raf = requestAnimationFrame(step); else persistName(name);
    };
    _raf = requestAnimationFrame(step);
  }

  // ── Shared named-profile library (usable on ANY panel) + per-panel assign ────
  function listPresets() { return profiles.library; }
  function currentCam(name) { const b = ensureBridge(name, indexForName(name)); const cam = {}; for (const [a] of AXES) cam[a] = clampAxis(a, Number(b[a]) || 0); return cam; }
  function savePreset(name, panelName) {
    panelName = panelName || editingName; name = String(name || '').trim(); if (!name) return;
    profiles.library = profiles.library.filter((p) => p.name !== name);
    profiles.library.push({ name, cam: currentCam(panelName), color: colorForName(panelName), savedAt: new Date().toISOString() });
    profiles.assignments[panelName] = name;   // saving puts this panel ON the new profile
    saveProfiles(); emit('presets'); emit('mode');
  }
  function updatePreset(name, panelName) {
    panelName = panelName || editingName;
    const i = profiles.library.findIndex((p) => p.name === name); if (i < 0) return;
    profiles.library[i] = { name, cam: currentCam(panelName), color: profiles.library[i].color || colorForName(panelName), savedAt: new Date().toISOString() };
    profiles.assignments[panelName] = name;
    saveProfiles(); emit('presets'); emit('mode');
  }
  function deletePreset(name) {
    profiles.library = profiles.library.filter((p) => p.name !== name);
    for (const n in profiles.assignments) if (profiles.assignments[n] === name) profiles.assignments[n] = null;
    saveProfiles(); emit('presets'); emit('mode');
  }
  function applyPreset(preset, panelName) {
    panelName = panelName || editingName; if (!preset || !preset.cam) return;
    ensureBridge(panelName, indexForName(panelName)).enabled = true;
    profiles.assignments[panelName] = preset.name || null;   // set before tween so syncLink mirrors it
    const target = {}; for (const [a] of AXES) target[a] = clampAxis(a, Number(preset.cam[a]) || 0);
    tween(panelName, target); syncLink(panelName); emit('change', panelName); emit('mode'); persistName(panelName);
  }
  function resetCamera(panelName) {
    panelName = panelName || editingName; profiles.assignments[panelName] = null;
    const target = {}; for (const [a] of AXES) target[a] = DEFAULTS[a]; tween(panelName, target); emit('mode');
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
  async function importFromFile(file, panelName) {
    panelName = panelName || editingName;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.kind !== EXPORT_KIND) throw 0;
      const inc = Array.isArray(data.presets) ? data.presets : (data.preset ? [data.preset] : []);
      if (!inc.length) throw 0;
      const byName = new Map(profiles.library.map((p) => [p.name, p]));
      for (const p of inc) {
        if (p && p.name && p.cam) byName.set(p.name, { name: p.name, cam: p.cam, color: p.color || colorForName(panelName), savedAt: p.savedAt || new Date().toISOString() });
      }
      profiles.library = [...byName.values()];
      saveProfiles(); emit('presets');
      if (inc.length === 1) applyPreset(inc[0], panelName);
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
    const name = nameForPoint(e.clientX, e.clientY);
    if (!name || !ensureBridge(name, indexForName(name)).enabled) return;
    drag = { name, x: e.clientX, y: e.clientY };
  });
  addL(window, 'pointermove', (e) => {
    if (!drag) return;
    const b = ensureBridge(drag.name, indexForName(drag.name));
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
    profiles.assignments[drag.name] = null; syncLink(drag.name); emit('change', drag.name); saveSoon();
  });
  addL(window, 'pointerup', () => { if (drag) { persistName(drag.name); drag = null; } });
  addL(window, 'wheel', (e) => {
    if (overUI(e) || !isCanvas(e.target)) return;
    const name = nameForPoint(e.clientX, e.clientY);
    if (!name || !ensureBridge(name, indexForName(name)).enabled) return;
    e.preventDefault();
    const b = bridges[name];
    b.distMul = clampAxis('distMul', (Number(b.distMul) || 1) * (1 + (e.deltaY > 0 ? 0.06 : -0.06)));
    profiles.assignments[name] = null; syncLink(name); emit('change', name); persistName(name);
  }, { passive: false });

  // ── Mode / focus reconciliation ─────────────────────────────────────────────
  let _lastSig = '';
  function modeSig() {
    if (!isSplit()) return 'single';
    const ps = getPanelList();
    return 'split:' + ps.map((p) => p.name).join('|') + ':' + ((ps.find((p) => p.focused) || {}).name || '');
  }
  function reconcile() {
    const sig = modeSig();
    if (sig === _lastSig) return;
    _lastSig = sig;
    // Editing follows the FOCUSED panel: clicking a splitscreen panel switches
    // the Camera Director's target (highlighted entry + profile dropdown +
    // sliders) to that panel. List clicks don't change focus, so sig is
    // unchanged then and this early-returns — the selection is preserved until
    // focus moves.
    if (isSplit()) {
      const fn = focusedName();
      if (currentPanelNames().includes(fn)) { editingName = fn; profiles.active = fn; }
    } else if (editingName === SINGLE_NAME || currentPanelNames().includes(editingName)) {
      // Non-split: default to the single view — but don't yank the user off a
      // remote (popped-out) panel they explicitly selected to steer.
      editingName = SINGLE_NAME; profiles.active = SINGLE_NAME;
    }
    // Only snap back if the edit target vanished entirely (not local AND not a
    // known remote panel).
    if (!currentPanelNames().includes(editingName) && !remoteNames().includes(editingName)) {
      editingName = currentPanelNames()[0] || SINGLE_NAME;
    }
    writeBridge();
    emit('mode');
  }
  const _pollT = setInterval(reconcile, 600);
  try { if (ss() && ss().onFocusChange) ss().onFocusChange(reconcile); } catch (e) { /* ignore */ }
  // Panel add/remove/rename fires this on the feedBack bus — re-sync promptly.
  const onPanelsChanged = () => { _lastSig = ''; reconcile(); };
  try { if (window.feedBack && window.feedBack.on) window.feedBack.on('splitscreen:panels-changed', onPanelsChanged); } catch (e) { /* ignore */ }
  writeBridge();
  // Push camera edits to popped-out follower windows: on every change (throttled)
  // plus a slow heartbeat so a late-joining / reconnecting follower stays synced;
  // the heartbeat also prunes followers that went stale (window closed silently).
  on('change', broadcastSoon);
  const _hbT = setInterval(() => { broadcastCams(); pruneRemotes(); }, 1000);
  // Solicit any already-open follower windows to announce their panels.
  camChannel(); requestRemotePanels();

  // ── Public API ──────────────────────────────────────────────────────────────
  window.__camDir = {
    version: VERSION,
    AXES, DEFAULTS, PANEL_COLORS,
    clampAxis, fmtAxis, parseAxis,
    isSplit, getMode: () => (isSplit() ? 'split' : 'single'),
    // Panel list for the UI: this window's tiled panels first, then popped-out
    // (remote) panels reported by follower windows — so main can steer them all.
    // key = panel NAME, label = name, color by position; `remote` flags followers.
    getSlots() {
      const local = getPanelList().map((p) => ({ key: p.name, color: colorForIndex(p.index), label: p.name, enabled: !!ensureBridge(p.name, p.index).enabled, focused: !!p.focused, remote: false }));
      const seen = new Set(local.map((s) => s.key));
      let ri = local.length;
      const remotes = [];
      for (const n of remoteNames()) { if (seen.has(n)) continue; seen.add(n); remotes.push({ key: n, color: colorForIndex(ri++), label: n, enabled: !!ensureBridge(n, null).enabled, focused: false, remote: true }); }
      return local.concat(remotes);
    },
    getEditingKey: () => editingName,
    setEditingKey(name) { if (currentPanelNames().includes(name) || remoteNames().includes(name)) { editingName = name; profiles.active = name; saveSoon(); emit('mode'); } },
    getColor: (name) => colorForName(name || editingName),
    getAxis: (key) => Number(editBridge()[key]) || 0,
    setAxis(key, val) { editBridge()[key] = clampAxis(key, val); profiles.assignments[editingName] = null; syncLink(editingName); emit('change', editingName); persistName(editingName); },
    getAssignment: (name) => profiles.assignments[name || editingName] || null,
    isEnabled: () => !!editBridge().enabled,
    setEnabled(b) { editBridge().enabled = !!b; syncLink(editingName); writeBridge(); emit('change', editingName); persistName(editingName); },
    // Link-all + bulk ops (splitscreen "across the board").
    isLinkAll: () => linkAll,
    setLinkAll(b) { linkAll = !!b; profiles.linkAll = linkAll; saveSoon(); if (linkAll) syncLink(editingName); writeBridge(); emit('mode'); },
    applyToAll,
    setEnabledAll,
    resetCamera: () => resetCamera(editingName),
    listPresets: () => listPresets(),
    savePreset: (n) => savePreset(n, editingName),
    updatePreset: (n) => updatePreset(n, editingName),
    deletePreset: (n) => deletePreset(n),
    applyPreset: (p) => applyPreset(p, editingName),
    exportPreset,
    importFromFile: (f) => importFromFile(f, editingName),
    on, off,
    destroy() {
      clearInterval(_pollT); clearInterval(_hbT); clearTimeout(_saveT); clearTimeout(_bcT); cancelAnimationFrame(_raf);
      try { if (_camCh) _camCh.close(); } catch (e) { /* ignore */ }
      try { if (ss() && ss().offFocusChange) ss().offFocusChange(reconcile); } catch (e) { /* ignore */ }
      try { if (window.feedBack && window.feedBack.off) window.feedBack.off('splitscreen:panels-changed', onPanelsChanged); } catch (e) { /* ignore */ }
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
