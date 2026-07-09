// Store-migration tests for camera-controller.js.
//
// The brain persists a name-keyed v4 store (LS 'camera_director.profiles.v3',
// discriminated by `_v`) and migrates forward from three legacy shapes:
//   v3  slot-keyed live + shared library   (same LS key, no `_v`)
//   v2  per-slot live + per-slot presets   (LS 'camera_director.profiles.v2')
//   v1  single live + flat presets         (LS 'camera_director.live'/'.presets')
// Legacy per-slot cameras are stashed by index and adopted the first time a
// panel appears at that index; in single (non-split) mode only the synthetic
// 'Main' panel (index 0) exists, so it adopts old slot A.
//
// These migrations are pure w.r.t. localStorage, so we exercise the REAL load
// path: run camera-controller.js in a vm with a seeded fake localStorage plus
// minimal DOM/timer stubs, then read the migrated state back through the public
// window.__camDir API. (No splitscreen present → single 'Main' panel.)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'camera-controller.js'), 'utf8');

// Build a sandbox with a seeded localStorage and run the brain in it. Returns
// window.__camDir. `store` maps LS key → already-JSON-stringified value.
function loadPlugin(store = {}) {
  const ls = new Map(Object.entries(store));
  const noopEl = () => ({ dataset: {}, style: {}, set src(v) {}, appendChild() {}, remove() {}, click() {}, setAttribute() {} });
  const win = {};
  const sandbox = {
    window: win,
    console: { log() {}, warn() {}, error() {} },
    location: { search: '' },
    URLSearchParams,
    localStorage: {
      getItem: (k) => (ls.has(k) ? ls.get(k) : null),
      setItem: (k, v) => ls.set(k, v),
      removeItem: (k) => ls.delete(k),
    },
    document: {
      body: { appendChild() {}, removeChild() {} },
      createElement: noopEl,
      querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
    },
    performance: { now: () => 0 },
    setInterval: () => 0, clearInterval() {},
    setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    // BroadcastChannel deliberately absent → typeof !== 'function' → the
    // cross-window path stays dormant (and never pins the event loop).
  };
  // The brain reads bare globals (window, document, localStorage, …) AND
  // window.*; point window at the same surface so both resolve.
  win.addEventListener = () => {};
  win.removeEventListener = () => {};
  win.__camDir = undefined;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win.__camDir;
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('v4 store loads as-is (name-keyed live + library + assignments)', () => {
  const api = loadPlugin({
    'camera_director.profiles.v3': JSON.stringify({
      _v: 4, active: 'Main', linkAll: false,
      live: { Main: { heightMul: 2 } },
      library: [{ name: 'X', cam: { yaw: 0.5 } }],
      assignments: { Main: 'X' },
    }),
  });
  assert.ok(api && !api.isFollower, 'main brain mounted');
  assert.equal(api.listPresets().map((p) => p.name).join(','), 'X');
  assert.ok(near(api.getAxis('heightMul'), 2), 'Main live camera preserved');
  assert.equal(api.getAssignment('Main'), 'X', 'assignment preserved');
});

test('v3 (slot-keyed) → v4: library kept, slot A adopted by Main, linkAll carried', () => {
  const api = loadPlugin({
    'camera_director.profiles.v3': JSON.stringify({
      linkAll: true,
      live: { A: { heightMul: 1.5 }, B: { heightMul: 0.5 } },
      library: [{ name: 'P', cam: { distMul: 2 } }],
      assignments: { A: 'P' },
    }),
  });
  assert.equal(api.listPresets().map((p) => p.name).join(','), 'P');
  assert.equal(api.isLinkAll(), true, 'linkAll migrated');
  assert.ok(near(api.getAxis('heightMul'), 1.5), 'Main adopted old slot A live');
  assert.equal(api.getAssignment('Main'), 'P', 'Main adopted slot A assignment');
});

test('v2 (per-slot live + per-slot presets) → v4', () => {
  const api = loadPlugin({
    'camera_director.profiles.v2': JSON.stringify({
      players: { A: { live: { yaw: 0.3 }, presets: [{ name: 'Q', cam: { pitch: 10 } }] } },
    }),
  });
  assert.equal(api.listPresets().map((p) => p.name).join(','), 'Q');
  assert.ok(near(api.getAxis('yaw'), 0.3), 'Main adopted slot A live from v2');
});

test('v1 (single live + flat presets) → v4', () => {
  const api = loadPlugin({
    'camera_director.live': JSON.stringify({ heightMul: 2.5 }),
    'camera_director.presets': JSON.stringify([{ name: 'R', cam: { yaw: 0.2 } }]),
  });
  assert.equal(api.listPresets().map((p) => p.name).join(','), 'R');
  assert.ok(near(api.getAxis('heightMul'), 2.5), 'Main took the v1 single live camera');
});

test('empty / corrupt storage → defaults, empty library', () => {
  const api = loadPlugin({ 'camera_director.profiles.v3': '{not json' });
  assert.equal(api.listPresets().length, 0);
  assert.ok(near(api.getAxis('heightMul'), 1), 'default heightMul');
  assert.ok(near(api.getAxis('yaw'), 0), 'default yaw');
});

test('migrated library cameras are clamped to axis ranges', () => {
  const api = loadPlugin({
    'camera_director.profiles.v3': JSON.stringify({
      _v: 4, live: {}, assignments: {},
      library: [{ name: 'clamp', cam: { yaw: 999, heightMul: 999 } }],
    }),
  });
  const cam = api.listPresets()[0].cam;
  assert.ok(cam.yaw <= 1.2 && cam.heightMul <= 3, 'out-of-range profile cam clamped');
});
