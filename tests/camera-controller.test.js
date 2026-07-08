'use strict';
// Coverage for the pure axis helpers in camera-controller.js: clamping,
// live-object normalization, and display/parse formatting round-trips.
// Runs under the org reusable CI as `node tests/camera-controller.test.js`.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function freshPlugin() {
    global.window = {};
    const file = path.join(__dirname, '..', 'camera-controller.js');
    delete require.cache[require.resolve(file)];
    return require(file);
}

const mod = freshPlugin();

test('clampAxis clamps each axis to its declared [min, max] range', () => {
    assert.equal(mod.clampAxis('heightMul', 10), 3);   // above max
    assert.equal(mod.clampAxis('heightMul', -5), 0.2);  // below min
    assert.equal(mod.clampAxis('heightMul', 1.5), 1.5); // in range
    assert.equal(mod.clampAxis('pitch', 999), 120);
    assert.equal(mod.clampAxis('panX', -500), -200);
});

test('clampAxis treats non-numeric input as 0 before clamping', () => {
    assert.equal(mod.clampAxis('yaw', 'nope'), 0);
    assert.equal(mod.clampAxis('yaw', undefined), 0);
    assert.equal(mod.clampAxis('yaw', NaN), 0);
});

test('clampAxis falls back to Number(v)||0 for an unknown axis key', () => {
    assert.equal(mod.clampAxis('bogus', 5), 5);
    assert.equal(mod.clampAxis('bogus', 'x'), 0);
});

test('stripLive normalizes an arbitrary object to only known axes, clamped', () => {
    const out = mod.stripLive({ enabled: true, heightMul: 99, distMul: 1, extra: 'ignored' });
    assert.equal(out.enabled, true);
    assert.equal(out.heightMul, 3); // clamped to axis max
    assert.equal(out.distMul, 1);
    assert.ok(!('extra' in out));
    for (const [key] of mod.AXES) assert.ok(key in out);
});

test('stripLive coerces a falsy enabled flag and missing axis values to 0', () => {
    const out = mod.stripLive({});
    assert.equal(out.enabled, false);
    assert.equal(out.yaw, 0);
});

test('fmtAxis formats yaw in degrees, mul axes with a x suffix, others as integers', () => {
    assert.equal(mod.fmtAxis('yaw', Math.PI / 2), '90°');
    assert.equal(mod.fmtAxis('heightMul', 1.5), '1.50×');
    assert.equal(mod.fmtAxis('distMul', 2), '2.00×');
    assert.equal(mod.fmtAxis('pitch', 45.6), '46');
});

test('parseAxis strips non-numeric characters and clamps the result', () => {
    assert.equal(mod.parseAxis('pitch', '45°'), 45);
    assert.equal(mod.parseAxis('heightMul', '1.5x'), 1.5);
    assert.equal(mod.parseAxis('pitch', '999'), 120); // clamped
});

test('parseAxis converts a degree string back to radians for yaw', () => {
    // yaw's clamp range is [-1.2, 1.2] rad (~68.75deg), so use an in-range value.
    const parsed = mod.parseAxis('yaw', '45°');
    assert.ok(Math.abs(parsed - Math.PI / 4) < 0.001);
});

test('parseAxis returns null for unparseable input', () => {
    assert.equal(mod.parseAxis('yaw', 'nope'), null);
    assert.equal(mod.parseAxis('yaw', ''), null);
});

test('fmtAxis and parseAxis round-trip for a mul axis', () => {
    const formatted = mod.fmtAxis('heightMul', 1.23);
    const parsed = mod.parseAxis('heightMul', formatted);
    assert.ok(Math.abs(parsed - 1.23) < 0.01);
});

test('DEFAULTS is frozen and covers every declared axis', () => {
    assert.throws(() => { mod.DEFAULTS.yaw = 5; }, TypeError);
    for (const [key] of mod.AXES) assert.ok(key in mod.DEFAULTS, `DEFAULTS missing ${key}`);
});
