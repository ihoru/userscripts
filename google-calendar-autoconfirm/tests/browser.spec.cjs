const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const fixture = readFileSync(join(__dirname, 'fixture.html'), 'utf8');
const script = readFileSync(join(__dirname, '../google-calendar-autoconfirm.user.js'), 'utf8');
const ROOT = '/calendar/u/0/';

async function setup(page, route = ROOT + 'r/week') {
  await page.clock.install();
  await page.route('https://calendar.google.com/**', r => r.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://calendar.google.com' + route);
  await page.addScriptTag({ content: script });
}
async function actions(page) { return page.evaluate(() => window.actions); }
async function run(page, ms = 1500) { await page.clock.runFor(ms); }

async function showTask(page, selected = 'Woal0c') {
  await page.evaluate(selected => {
    const dialog = showDialog(selected);
    dialog.querySelector('h2').textContent = 'Save repeating task';
    const labels = dialog.querySelectorAll('label');
    labels[0].querySelector('.qUJind').textContent = 'This task';
    labels[2].querySelector('.qUJind').textContent = 'All tasks';
    labels[1].remove();
    dialog.querySelectorAll('input[type="radio"]').forEach(r => { r.style.opacity = '0'; });
  }, selected);
}

for (const selected of ['Woal0c', 'NkyfNe']) {
  test(`Save repeating task confirms only This task from ${selected}`, async ({ page }) => {
    await setup(page);
    await showTask(page, selected);
    await run(page);
    expect(await actions(page)).toEqual(selected === 'Woal0c' ? ['ok:Woal0c'] : ['select:Woal0c', 'ok:Woal0c']);
    await expect(page.locator('#slot [role="dialog"]')).toHaveCount(0);
  });
}

test('task saves remain manual in the full editor and after returning to the calendar', async ({ page }) => {
  await setup(page, ROOT + 'r/eventedit/invented-id');
  await showTask(page, 'NkyfNe');
  await run(page);
  expect(await actions(page)).toEqual([]);
  await page.evaluate(() => history.replaceState({}, '', '/calendar/u/0/r/week'));
  await run(page);
  expect(await actions(page)).toEqual([]);
});

test('task saves wait for enabled OK, handle repeated dialogs, and log the correct scope', async ({ page }) => {
  await setup(page);
  await captureLogs(page);
  await showTask(page, 'NkyfNe');
  await page.locator('#slot button[data-mdc-dialog-action="ok"]').evaluate(el => { el.disabled = true; });
  await run(page);
  expect(await actions(page)).toEqual([]);
  await page.evaluate(() => { document.querySelector('#slot button[data-mdc-dialog-action="ok"]').disabled = false; });
  await run(page);
  await showTask(page);
  await run(page);
  expect(await actions(page)).toEqual(['select:Woal0c', 'ok:Woal0c', 'ok:Woal0c']);
  const logs = await page.evaluate(() => dialogLogs);
  expect(logs.some(args => args[0].includes('Select This task'))).toBe(true);
  expect(logs.filter(args => args[0].includes('closed after confirming This task'))).toHaveLength(2);
});

test('a manual task-scope change cancels automatic confirmation', async ({ page }) => {
  await setup(page);
  await showTask(page);
  await run(page, 160);
  await page.getByRole('radio', { name: 'All tasks', exact: true }).check();
  await run(page);
  expect(await actions(page)).toEqual(['select:NkyfNe']);
});

for (const problem of ['event-labels', 'unobserved-title', 'wrong-action']) {
  test(`leaves task dialog manual for ${problem}`, async ({ page }) => {
    await setup(page);
    await showTask(page);
    await page.evaluate(problem => {
      const dialog = document.querySelector('#slot [role="dialog"]');
      if (problem === 'event-labels') dialog.querySelector('.qUJind').textContent = 'This event';
      if (problem === 'unobserved-title') dialog.querySelector('h2').textContent = 'Delete repeating task';
      if (problem === 'wrong-action') dialog.querySelector('[data-mdc-dialog-action="ok"]').textContent = 'Delete';
    }, problem);
    await run(page);
    expect(await actions(page)).toEqual([]);
  });
}

for (const selected of ['Woal0c', 'NkyfNe', 'Y8PVec']) {
  test(`selects this occurrence from ${selected}, confirms once and accepts later dialogs`, async ({ page }) => {
    await setup(page);
    await page.evaluate(selected => showDialog(selected), selected);
    await run(page);
    expect(await actions(page)).toEqual(selected === 'Woal0c' ? ['ok:Woal0c'] : ['select:Woal0c', 'ok:Woal0c']);
    await expect(page.locator('#slot [role="dialog"]')).toHaveCount(0);
    await page.addScriptTag({ content: script });
    await page.evaluate(() => showDialog());
    await run(page);
    expect((await actions(page)).filter(a => a.startsWith('ok:'))).toEqual(['ok:Woal0c', 'ok:Woal0c']);
    await expect(page.locator('#iho-calendar-autoconfirm')).toHaveCount(1);
  });
}

for (const route of [ROOT + 'r/eventedit/invented-id', ROOT + 'eventedit/', ROOT + 'r/eventedit', '/calendar/u/12/r/eventedit/invented-id']) {
  test(`leaves ${route} manual, including route departure with an open dialog`, async ({ page }) => {
    await setup(page, route);
    await page.evaluate(() => showDialog('NkyfNe'));
    await run(page);
    expect(await actions(page)).toEqual([]);
    await page.evaluate(() => history.pushState({}, '', '/calendar/u/0/r/week'));
    await run(page);
    // A dialog already observed in the full editor stays manual after navigation.
    if (route.includes('eventedit')) expect(await actions(page)).toEqual([]);
  });
}

for (const account of [0, 1, 12]) {
  test(`confirms edits for account ${account}`, async ({ page }) => {
    await setup(page, `/calendar/u/${account}/r/week`);
    await page.evaluate(() => showDialog('NkyfNe'));
    await run(page);
    expect(await actions(page)).toEqual(['select:Woal0c', 'ok:Woal0c']);
  });
}

for (const route of ['/calendar/u/me/r/week', '/calendar/u/1extra/r/week', '/calendar/settings']) {
  test(`does not act on unsupported route ${route}`, async ({ page }) => {
    await setup(page, route);
    await page.evaluate(() => showDialog());
    await run(page);
    expect(await actions(page)).toEqual([]);
  });
}

test('uses accessible labels after generated values, IDs, controllers, classes and option order change', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const dialog = showDialog('NkyfNe');
    dialog.querySelectorAll('input[type="radio"]').forEach((r, index) => {
      r.value = `rotated-${index}`;
      const text = dialog.querySelector(`[id="${r.getAttribute('aria-labelledby')}"]`);
      text.id = `new-label-${index}`;
      r.setAttribute('aria-labelledby', text.id);
    });
    dialog.parentElement.removeAttribute('jscontroller');
    dialog.querySelectorAll('[jscontroller], [class], [data-mdc-dialog-action]').forEach(el => {
      for (const attr of ['jscontroller', 'class', 'data-mdc-dialog-action']) el.removeAttribute(attr);
    });
    const group = dialog.querySelector('[role="radiogroup"]');
    group.append(group.firstElementChild);
  });
  await run(page);
  expect(await actions(page)).toEqual(['select:rotated-0', 'ok:rotated-0']);
});

for (const naming of ['aria-label', 'html-label']) {
  test(`supports ${naming} names without aria-labelledby`, async ({ page }) => {
    await setup(page);
    await page.evaluate(naming => {
      const dialog = showDialog('NkyfNe');
      dialog.querySelectorAll('input[type="radio"]').forEach(r => {
        const text = dialog.querySelector(`[id="${r.getAttribute('aria-labelledby')}"]`);
        if (naming === 'aria-label') r.setAttribute('aria-label', text.textContent);
        r.removeAttribute('aria-labelledby');
      });
    }, naming);
    await run(page);
    expect(await actions(page)).toEqual(['select:Woal0c', 'ok:Woal0c']);
  });
}

test('recognizes transparent Material radio inputs using their visible labels', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const dialog = showDialog('NkyfNe');
    dialog.querySelectorAll('input[type="radio"]').forEach(r => { r.style.opacity = '0'; });
    // The observed Calendar dialog can contain only This event and All events.
    dialog.querySelectorAll('label')[1].remove();
  });
  await run(page);
  expect(await actions(page)).toEqual(['select:Woal0c', 'ok:Woal0c']);
});

test('preserves editor provenance after Save returns to the calendar, then permits new grid edits', async ({ page }) => {
  await setup(page, ROOT + 'r/eventedit/invented-id');
  await page.evaluate(() => {
    history.replaceState({}, '', '/calendar/u/0/r/week');
    showDialog('NkyfNe');
  });
  await run(page);
  expect(await actions(page)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await run(page, 200);
  await page.locator('#calendar-action').click();
  await page.evaluate(() => showDialog());
  await run(page);
  expect(await actions(page)).toEqual(['ok:Woal0c']);
});

test('navigation into the editor cancels a scheduled confirmation, including browser Back', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => showDialog());
  await run(page, 160);
  await page.evaluate(() => history.pushState({}, '', '/calendar/u/0/r/eventedit/invented-id'));
  await run(page);
  await page.goBack();
  await run(page);
  expect(await actions(page)).toEqual([]);
});

test('waits for delayed content, enabled controls and layout; ignores hidden duplicates', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const dialog = showDialog();
    dialog.parentElement.hidden = true;
    const hidden = dialog.parentElement.cloneNode(true);
    hidden.hidden = true;
    hidden.querySelectorAll('input[type="radio"]').forEach(r => { r.name = 'hidden-dialog'; });
    document.body.append(hidden);
    const button = dialog.querySelector('[data-mdc-dialog-action="ok"]');
    button.disabled = true;
    setTimeout(() => { dialog.parentElement.hidden = false; }, 500);
    setTimeout(() => { button.disabled = false; }, 1800);
  });
  await run(page);
  expect(await actions(page)).toEqual([]);
  await run(page);
  expect(await actions(page)).toEqual(['ok:Woal0c']);
});

for (const problem of ['unrelated-delete', 'unknown-radio', 'duplicate-radio', 'non-english', 'duplicate-ok', 'obstructed', 'disabled-radio', 'disabled-ok', 'incomplete']) {
  test(`does not confirm ${problem}`, async ({ page }) => {
    await setup(page);
    await page.evaluate(problem => {
      const dialog = showDialog();
      if (problem === 'unrelated-delete') dialog.querySelector('h2').textContent = 'Delete calendar';
      if (problem === 'unknown-radio') dialog.querySelector('input').setAttribute('aria-labelledby', 'missing-label');
      if (problem === 'duplicate-radio') dialog.querySelectorAll('input')[1].setAttribute('aria-labelledby', dialog.querySelector('input').getAttribute('aria-labelledby'));
      if (problem === 'non-english') dialog.querySelector('h2').textContent = 'Изменение повторяющегося мероприятия';
      if (problem === 'duplicate-ok') dialog.append(dialog.querySelector('[data-mdc-dialog-action="ok"]').cloneNode(true));
      if (problem === 'disabled-radio') dialog.querySelector('input').disabled = true;
      if (problem === 'disabled-ok') dialog.querySelector('[data-mdc-dialog-action="ok"]').disabled = true;
      if (problem === 'incomplete') dialog.querySelector('[role="radiogroup"]').remove();
      if (problem === 'obstructed') {
        const cover = document.createElement('div');
        cover.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:10';
        document.body.append(cover);
      }
    }, problem);
    await run(page, 12000);
    expect(await actions(page)).toEqual([]);
  });
}

test('manual radio selection and keyboard intervention invalidate pending confirmation', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => showDialog());
  await run(page, 160);
  await page.getByRole('radio', { name: 'All events', exact: true }).check();
  await run(page);
  expect(await actions(page)).toEqual(['select:NkyfNe']);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await run(page, 200);
  await page.evaluate(() => showDialog());
  await run(page, 160);
  await page.keyboard.press('Escape');
  await run(page);
  expect(await actions(page)).toEqual(['select:NkyfNe']);
});

test('Pause persists across dialogs; Resume skips invalidated work and enables subsequent dialogs', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => showDialog());
  await run(page, 160);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await run(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await run(page);
  expect(await actions(page)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await run(page, 200);
  await page.evaluate(() => showDialog());
  await run(page);
  expect(await actions(page)).toEqual(['ok:Woal0c']);
});

test('never retries stalled OK; a stale toast does not prove completion', async ({ page }) => {
  await setup(page);
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  await page.evaluate(() => {
    hold = true;
    showDialog();
    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.textContent = 'Event saved';
    document.body.append(toast);
  });
  await run(page, 12000);
  expect(await actions(page)).toEqual(['ok:Woal0c']);
  expect(logs.some(l => l.includes('closed after confirming'))).toBe(false);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await run(page, 5000);
  expect(await actions(page)).toEqual(['ok:Woal0c']);
});

test('unexpected dialogs stop an action in flight', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { hold = true; showDialog(); });
  await run(page);
  await page.evaluate(() => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.textContent = 'Unexpected error';
    document.body.append(dialog);
  });
  await run(page);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  expect(await actions(page)).toEqual(['ok:Woal0c']);
});

test('bug report includes versions and the account slot in a sanitized route after navigation', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => history.pushState({}, '', '/calendar/u/12/r/eventedit/private-id?secret=value#private'));
  await run(page);
  const url = new URL(await page.getByRole('link', { name: 'Report a bug' }).getAttribute('href'));
  expect(url.searchParams.get('script')).toBe('Google Calendar Autoconfirm 1.0.4');
  expect(url.searchParams.get('page')).toBe('https://calendar.google.com/calendar/u/12/r/eventedit/');
  expect(url.href).not.toMatch(/private-id|secret|value/);
  expect(url.searchParams.get('environment')).toContain('please specify');
});

for (const buttonName of ['OK', 'Delete']) {
  for (const inEditor of [false, true]) {
    test(`recurring deletion with ${buttonName} ${inEditor ? 'stays manual in the editor' : 'confirms only this occurrence'}`, async ({ page }) => {
      await setup(page, ROOT + (inEditor ? 'r/eventedit/invented-id' : 'r/week'));
      await page.evaluate(buttonName => {
        const dialog = showDialog('NkyfNe');
        dialog.querySelector('h2').textContent = 'Delete recurring event';
        dialog.querySelector('[data-mdc-dialog-action="ok"]').textContent = buttonName;
        dialog.querySelectorAll('input').forEach(r => { r.style.opacity = '0'; });
      }, buttonName);
      await run(page);
      expect(await actions(page)).toEqual(inEditor ? [] : ['select:Woal0c', 'ok:Woal0c']);
    });
  }
}

test('collapse to a tiny dot keeps automation running and expands on click', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Collapse panel to dot' }).click();
  const dot = page.getByRole('button', { name: 'Expand Google Calendar Autoconfirm panel' });
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeHidden();
  expect((await dot.boundingBox()).width).toBe(14);
  await page.evaluate(() => showDialog());
  await run(page);
  expect(await actions(page)).toEqual(['ok:Woal0c']);
  await dot.click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse panel to dot' })).toHaveAttribute('aria-expanded', 'true');
});

test('remembers collapsed and expanded states across reloads and account pages', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Collapse panel to dot' }).click();
  await page.reload();
  await page.addScriptTag({ content: script });
  const dot = page.getByRole('button', { name: 'Expand Google Calendar Autoconfirm panel' });
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute('aria-expanded', 'false');
  expect((await dot.boundingBox()).width).toBe(14);
  await page.evaluate(() => showDialog());
  await run(page);
  expect(await actions(page)).toEqual(['ok:Woal0c']);

  await page.goto('https://calendar.google.com/calendar/u/12/r/week');
  await page.addScriptTag({ content: script });
  await expect(dot).toBeVisible();
  await dot.click();
  await page.reload();
  await page.addScriptTag({ content: script });
  await expect(page.getByRole('button', { name: 'Collapse panel to dot' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

for (const method of ['getItem', 'setItem']) {
  test(`storage ${method} failure leaves the panel and automation usable`, async ({ page }) => {
    const errors = [];
    const warnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'warning') warnings.push(msg.text()); });
    await page.addInitScript(method => {
      Storage.prototype[method] = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
    }, method);
    await setup(page);
    await page.getByRole('button', { name: 'Collapse panel to dot' }).click();
    const dot = page.getByRole('button', { name: 'Expand Google Calendar Autoconfirm panel' });
    await expect(dot).toBeVisible();
    await page.evaluate(() => showDialog());
    await run(page);
    expect(await actions(page)).toEqual(['ok:Woal0c']);
    await dot.click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(warnings.some(m => m.includes(method === 'getItem' ? 'Could not restore panel preference' : 'Could not save panel preference'))).toBe(true);
  });
}

async function captureLogs(page) {
  await page.evaluate(() => {
    window.dialogLogs = [];
    const original = console.log;
    console.log = (...args) => { dialogLogs.push(args); original(...args); };
  });
}

test('logs each creation and decision once per change, without polling spam', async ({ page }) => {
  await setup(page);
  await captureLogs(page);
  await page.evaluate(() => { hold = true; showDialog('NkyfNe'); });
  await run(page, 2000);
  let logs = await page.evaluate(() => dialogLogs);
  const messages = logs.map(args => args[0]);
  expect(messages.filter(m => m.includes(': created'))).toHaveLength(1);
  expect(messages.filter(m => m.includes(': select:'))).toHaveLength(1);
  expect(messages.filter(m => m.includes(': confirm:'))).toHaveLength(1);
  expect(messages.some(m => m.includes('waiting for dialog to close'))).toBe(true);
  await run(page, 2000);
  expect(await page.evaluate(() => dialogLogs.length)).toBe(logs.length);
  await page.evaluate(() => document.querySelector('#slot').replaceChildren());
  await run(page, 200);
  await page.evaluate(() => { hold = false; showDialog(); });
  await run(page);
  logs = await page.evaluate(() => dialogLogs);
  expect(logs.filter(args => args[0].includes(': created'))).toHaveLength(2);
  expect(logs.filter(args => args[0].includes('Dialog 1: closed'))).toHaveLength(1);
  expect(logs.some(args => args[0].includes('Dialog 2: confirm:'))).toBe(true);
});

test('logs a specific rejection reason and sanitized control diagnostics', async ({ page }) => {
  await setup(page);
  await captureLogs(page);
  await page.evaluate(() => {
    const dialog = showDialog();
    dialog.querySelector('input').setAttribute('aria-label', 'PRIVATE EVENT CONTENT');
    dialog.querySelector('input').removeAttribute('aria-labelledby');
  });
  await run(page);
  const logs = await page.evaluate(() => dialogLogs);
  const rejected = logs.find(args => args[0].includes(': unrecognized:'));
  expect(rejected[0]).toContain('Missing visible radio named This event');
  expect(rejected[1].radioNames).toContain('[unrecognized]');
  expect(JSON.stringify(logs)).not.toContain('PRIVATE EVENT CONTENT');
  const count = logs.length;
  await run(page);
  expect(await page.evaluate(() => dialogLogs.length)).toBe(count);
  expect(await actions(page)).toEqual([]);
});

for (const mode of ['paused', 'editor', 'unsupported']) {
  test(`logs creation and decision while ${mode}`, async ({ page }) => {
    await setup(page, mode === 'editor' ? ROOT + 'r/eventedit/invented-id' : mode === 'unsupported' ? '/calendar/settings' : ROOT + 'r/week');
    await captureLogs(page);
    if (mode === 'paused') await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => showDialog());
    await run(page);
    const messages = await page.evaluate(() => dialogLogs.map(args => args[0]));
    expect(messages.filter(m => m.includes(': created'))).toHaveLength(1);
    expect(messages.some(m => m.includes(mode === 'paused' ? 'Automation is paused' : mode === 'editor' ? 'Full editor' : 'Unsupported route'))).toBe(true);
    expect(await actions(page)).toEqual([]);
  });
}

test('logs short-lived and hidden dialog creation without private dialog text', async ({ page }) => {
  await setup(page);
  await captureLogs(page);
  await page.evaluate(() => {
    const hidden = document.createElement('div');
    hidden.setAttribute('role', 'dialog');
    hidden.hidden = true;
    hidden.textContent = 'PRIVATE DIALOG CONTENT';
    document.body.append(hidden);
    const brief = hidden.cloneNode(true);
    document.body.append(brief);
    brief.remove();
  });
  await run(page);
  const logs = await page.evaluate(() => dialogLogs);
  expect(logs.filter(args => args[0].includes(': created'))).toHaveLength(2);
  expect(logs.some(args => args[0].includes('Dialog is hidden'))).toBe(true);
  expect(logs.some(args => args[0].includes('Removed from the page'))).toBe(true);
  expect(JSON.stringify(logs)).not.toContain('PRIVATE DIALOG CONTENT');
});
