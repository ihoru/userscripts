const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createController } = require('./duocards-auto-import.user.js');

const card = (extra = {}) => ({
  active: true, position: '1/2', front: 'word', back: 'translation', hint: 'An example.',
  imageSource: 'picture.svg', imageReady: true, busy: false, duplicate: false,
  saveEnabled: true, resetEnabled: false, skipEnabled: true, resetSuccess: false,
  ...extra,
});
function settled(c, s = card()) { c.tick(s, 0); return c.tick(s, 1000); }

test('waits for delayed picture and example, then a stable second', () => {
  const c = createController();
  assert.equal(c.tick(card({ imageReady: false, hint: '' }), 0).action, undefined);
  assert.equal(c.tick(card({ hint: '' }), 2000).action, undefined);
  assert.equal(c.tick(card(), 3000).action, undefined);
  assert.equal(c.tick(card(), 3999).action, undefined);
  assert.equal(c.tick(card(), 4000).action, 'save');
});
test('loading indicator blocks readiness', () => {
  const c = createController();
  assert.equal(settled(c, card({ busy: true })).action, undefined);
  assert.equal(c.tick(card(), 2000).action, undefined);
  assert.equal(c.tick(card(), 3000).action, 'save');
});
test('missing content is saved at sixty seconds', () => {
  const c = createController(); const s = card({ imageReady: false, hint: '' });
  c.tick(s, 0);
  assert.equal(c.tick(s, 59999).action, undefined);
  assert.equal(c.tick(s, 60000).action, 'save');
});
test('never overrides disabled Save, even after timeout', () => {
  const c = createController(); const s = card({ saveEnabled: false });
  c.tick(s, 0);
  assert.equal(c.tick(s, 1000).action, undefined);
  assert.equal(c.tick(s, 60000).paused, true);
});
test('save fires once and stalls safely without a transition', () => {
  const c = createController(); assert.equal(settled(c).action, 'save');
  assert.equal(c.tick(card(), 1250).action, undefined);
  assert.equal(c.tick(card(), 21000).paused, true);
});
test('duplicate resets despite disabled Save and only skips after confirmation and clear', () => {
  const c = createController();
  const dup = card({ duplicate: true, resetEnabled: true, saveEnabled: false });
  assert.equal(settled(c, dup).action, 'reset');
  assert.equal(c.tick(dup, 1250).action, undefined);
  const empty = card({ front: '', back: '', hint: '', saveEnabled: false });
  assert.equal(c.tick(empty, 1500).action, undefined);
  assert.equal(c.tick({ ...empty, resetSuccess: true }, 1750).action, 'skip');
  assert.equal(c.tick(empty, 2000).action, undefined);
  assert.equal(c.tick(card({ position: '2/2', front: 'next' }), 2500).action, undefined);
  assert.equal(c.tick(card({ position: '2/2', front: 'next' }), 3500).action, 'save');
});
test('cleared duplicate without success must never be skipped', () => {
  const c = createController(); settled(c, card({ duplicate: true, resetEnabled: true }));
  const empty = card({ front: '', back: '', duplicate: false });
  assert.equal(c.tick(empty, 2000).action, undefined);
  assert.equal(c.tick(empty, 21000).paused, true);
});
test('reset may advance directly or leave an enabled Save', () => {
  for (const advanced of [true, false]) {
    const c = createController(); settled(c, card({ duplicate: true, resetEnabled: true }));
    const next = card({ position: advanced ? '2/2' : '1/2' });
    assert.equal(c.tick(next, 2000).action, undefined);
    assert.equal(c.tick(next, 3000).action, 'save');
  }
});
test('identical words on separate import positions each save once', () => {
  const c = createController(); settled(c);
  const next = card({ position: '2/2' });
  c.tick(next, 2000);
  assert.equal(c.tick(next, 3000).action, 'save');
});
test('pause persists across rows and resumes normally', () => {
  const c = createController(); c.tick(card(), 0); c.toggle(500);
  assert.equal(c.tick(card(), 2000).paused, true);
  const next = card({ position: '2/2' });
  assert.equal(c.tick(next, 3000).paused, true);
  c.toggle(4000);
  assert.equal(c.tick(next, 4000).action, undefined);
  assert.equal(c.tick(next, 5000).action, 'save');
});
test('completion and normal editing do nothing', () => {
  const c = createController(); settled(c);
  assert.equal(c.tick({ active: false }, 2000).action, undefined);
  assert.equal(c.tick({ active: false }, 3000).action, undefined);
});
test('unexpected app messages pause before clicking', () => {
  const c = createController(); c.tick(card(), 0);
  const r = c.tick(card({ blocker: 'Network error' }), 1000);
  assert.equal(r.paused, true); assert.equal(r.action, undefined);
});
test('word changes restart content waiting; empty transitional forms never save', () => {
  const c = createController(); c.tick(card(), 0);
  assert.equal(c.tick(card({ front: 'other' }), 1000).action, undefined);
  assert.equal(c.tick(card({ front: '', back: '' }), 2000).action, undefined);
});
