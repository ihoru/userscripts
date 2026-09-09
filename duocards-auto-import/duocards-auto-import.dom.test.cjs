const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(process.env.USER_SCRIPT || __dirname + '/duocards-auto-import.user.js', 'utf8');

// Execute the entire userscript against a minimal DOM matching the inspected
// library editor. This includes URL gating, DOM reads and the actual click.
function page(pathname, importing = true, notice = 'editor') {
  let now = 0;
  let poll;
  let clicks = 0;
  const elements = new Map();
  const node = (extra = {}) => ({
    style: {}, textContent: '', hidden: false,
    getClientRects: () => [{}], getAttribute: () => null,
    setAttribute() {}, append() {}, addEventListener() {}, contains: () => false, replaceChildren() {},
    ...extra,
  });
  const save = node({ disabled: false, closest: () => form, click: () => clicks++ });
  const form = node({
    querySelector: selector => ({
      '[class*="CardForm__Importing"]': importing ? node({ textContent: 'Import 2 / 3' }) : null,
      'input[name="front"]': { value: 'word' },
      'input[name="back"]': { value: 'translation' },
      'textarea[name="hint"]': { value: 'An example.' },
    })[selector] || null,
    querySelectorAll: selector => selector === '[class*="CardImgPicker__ImgWrap"] img'
      ? [node({ complete: true, naturalWidth: 150, currentSrc: 'image.svg' })]
      : selector === 'button' ? [save] : [],
  });
  const document = {
    body: node({ append: element => elements.set(element.id, element) }),
    createElement: () => node(),
    getElementById: id => elements.get(id),
    querySelector: selector => selector === '#addCard' ? save : null,
    addEventListener() {},
    querySelectorAll: selector => selector === '#addCard' ? [save] : notice === 'editor'
      ? [node({ textContent: 'Book editor Done Import 1 / 2', contains: el => el === form })]
      : notice === 'success' ? [node({ textContent: 'Card added.', className: 'MuiAlert-standardSuccess' })]
      : notice === 'error' ? [node({ textContent: 'Network error' })] : [],
  };
  runInNewContext(source, {
    URL, document, location: { pathname }, performance: { now: () => now },
    getComputedStyle: () => ({ visibility: 'visible' }),
    MutationObserver: class { observe() {} }, window: { addEventListener() {} },
    setTimeout: callback => { poll = callback; return 1; }, clearTimeout() {},
  });
  now = 1000;
  poll();
  return { clicks, panel: elements.get('ihoru-duocards-auto-import') };
}

test('full script saves a ready library-editor import', () => {
  const result = page('/library/edit');
  assert.equal(result.clicks, 1, 'Ready library import must be saved');
  assert.equal(result.panel.hidden, false);
});
test('full script still saves a main-card import', () => {
  assert.equal(page('/main/card').clicks, 1);
});
test('ordinary library editing and unrelated routes stay manual', () => {
  assert.equal(page('/library/edit', false).clicks, 0);
  assert.equal(page('/library', true).clicks, 0);
});

test('success alerts do not pause imports', () => {
  assert.equal(page('/library/edit', true, 'success').clicks, 1);
});
test('error alerts still block automatic clicks', () => {
  assert.equal(page('/library/edit', true, 'error').clicks, 0);
});
