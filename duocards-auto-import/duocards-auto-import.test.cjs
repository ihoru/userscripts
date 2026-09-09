const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createController } = require('./duocards-auto-import.user.js');

const card = (extra = {}) => ({
  active: true, position: '1/2', front: 'word', back: 'translation', hint: 'An example.',
  imageSource: 'picture.svg', imageReady: true, busy: false, duplicate: false,
  saveEnabled: true, resetEnabled: false, skipEnabled: true, resetSignal: 0,
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
  assert.equal(c.tick({ ...empty, resetSignal: 1 }, 1750).action, 'skip');
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
    const next = card({ position: advanced ? '2/2' : '1/2', resetSignal: 1 });
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


test('logs successful saves once with the completed row values, then continues', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c);
  const next = card({ position: '2/2', front: 'next', back: 'next translation' });
  c.tick(next, 1500);
  assert.deepEqual(logs, ['1/2 Added: word - translation']);
  assert.equal(c.tick(next, 2500).action, 'save');
  c.tick({ active: false, completed: true }, 3000);
  c.tick({ active: false, completed: true }, 3500);
  assert.deepEqual(logs, ['1/2 Added: word - translation', '2/2 Added: next - next translation']);
});
test('reset log keeps the original word through empty form and Skip', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c, card({ duplicate: true, resetEnabled: true }));
  const empty = card({ front: '', back: '', resetSignal: 1 });
  assert.equal(c.tick(empty, 1500).action, 'skip');
  c.tick(empty, 1600);
  c.tick(card({ position: '2/2', front: 'next' }), 2000);
  assert.deepEqual(logs, ['1/2 Progress reset: word']);
});
test('success toast alone does not confirm a save before transition', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c);
  assert.equal(c.tick(card({ addedSuccess: true }), 1200).paused, undefined);
  assert.deepEqual(logs, []);
  c.tick(card({ position: '2/2' }), 1500);
  assert.deepEqual(logs, ['1/2 Added: word - translation']);
});
test('clicks and navigation away are not logged as successful operations', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c);
  assert.deepEqual(logs, []);
  c.tick({ active: false }, 2000);
  assert.deepEqual(logs, []);
});

test('manual Skip or edit invalidates pending save and keeps summary honest', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c); c.manual();
  const result = c.tick(card({position:'2/2'}), 1500);
  assert.equal(result.paused, true);
  assert.deepEqual(logs, []);
  assert.equal(c.summary(), '0 added · 0 progress resets');
});
test('jumped counter and replacement form do not confirm saves', () => {
  for (const next of [card({position:'3/4'}), card({position:'2/2', context:'replacement'})]) {
    const logs = []; const c = createController(line => logs.push(line));
    settled(c);
    assert.equal(c.tick(next, 1500).paused, true);
    assert.deepEqual(logs, []);
  }
});
test('only the final row can finish a batch and count as saved', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c);
  assert.equal(c.tick({active:false, completed:true}, 1500).paused, true);
  assert.deepEqual(logs, []);
});
test('stale reset notifications never confirm the new reset', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c, card({duplicate:true, resetEnabled:true, resetSignal:4}));
  assert.equal(c.tick(card({front:'', back:'', resetSignal:4}), 1500).action, undefined);
  assert.deepEqual(logs, []);
  assert.equal(c.tick(card({front:'', back:'', resetSignal:5}), 1700).action, 'skip');
  assert.deepEqual(logs, ['1/2 Progress reset: word']);
});
test('final duplicate completes once and preserves its original word', () => {
  const logs = []; const c = createController(line => logs.push(line));
  settled(c, card({position:'1/1', duplicate:true, resetEnabled:true}));
  const empty = card({position:'1/1', front:'', back:'', resetSignal:1});
  assert.equal(c.tick(empty, 1500).action, 'skip');
  assert.equal(c.tick({active:false, completed:true, resetSignal:1}, 1800).status, 'Import finished');
  c.tick({active:false, completed:true}, 2000);
  assert.deepEqual(logs, ['1/1 Progress reset: word']);
  assert.equal(c.summary(), '0 added · 1 progress resets');
});
test('loading statuses distinguish missing picture and missing example', () => {
  assert.equal(createController().tick(card({imageReady:false}), 0).status, 'Waiting for picture');
  assert.equal(createController().tick(card({hint:''}), 0).status, 'Waiting for example');
});
test('displayed version matches installation metadata', () => {
  const { VERSION } = require('./duocards-auto-import.user.js');
  const source = require('node:fs').readFileSync(__dirname + '/duocards-auto-import.user.js', 'utf8');
  assert.equal(source.match(/@version\s+(\S+)/)[1], VERSION);
});
test('scheduler coalesces mutation bursts without starvation and allows idle intervals', () => {
  const { createScheduler } = require('./duocards-auto-import.user.js');
  let now = 0, id = 0, runs = 0;
  const queue = new Map();
  const clock = {now:()=>now, set:(fn,delay)=>{queue.set(++id,{fn,at:now+delay});return id;},clear:id=>queue.delete(id)};
  const schedule = createScheduler(()=>runs++,clock);
  schedule(2000);
  for (let n=0;n<100;n++) schedule(80);
  assert.equal(queue.size,1);
  const job = [...queue.values()][0]; assert.equal(job.at,80);
  now=80;queue.clear();job.fn();assert.equal(runs,1);
  schedule(0);assert.equal([...queue.values()][0].at,160);
});
