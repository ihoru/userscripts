const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const fixture = readFileSync(join(__dirname, 'fixture.html'), 'utf8');
const script = readFileSync(join(__dirname, '../toggl-auto-favorites.user.js'), 'utf8');

async function setup(page, configure = () => {}, route = '/timer?redirect_uri=ignored') {
  await page.route('https://track.toggl.com/**', r => r.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://track.toggl.com' + route);
  await page.evaluate(configure);
  const logs = [];
  page.on('console', msg => { if (msg.text().startsWith('[Toggl Auto Favorites')) logs.push(msg.text()); });
  await page.addScriptTag({ content: script });
  return logs;
}
async function events(page) { return page.evaluate(() => window.events); }
async function complete(logs) { await expect.poll(() => logs.some(s => s.includes('sidebar open;'))).toBe(true); }

for (const width of [1157, 714]) {
  test(`opens once at ${width}px and respects subsequent manual changes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 958 });
    const logs = await setup(page);
    await complete(logs);
    expect(await events(page)).toEqual(width === 1157 ? ['nav', 'favorite'] : ['favorite']);
    await expect(page.locator('.fixture-SidebarRight')).toBeVisible();
    await expect(page.locator('details')).not.toHaveAttribute('open');
    await page.locator('#favorite').click();
    await page.waitForTimeout(1300);
    await expect(page.locator('.fixture-SidebarRight')).toHaveCount(0);
    expect((await events(page)).filter(e => e === 'favorite')).toHaveLength(2);
    expect(await events(page)).not.toContain('unrelated');
  });
}

test('already open and collapsed requires no clicks, including duplicate injection and query changes', async ({ page }) => {
  const logs = await setup(page, () => { openSidebar(); document.querySelector('nav').classList.add('collapsed'); });
  await complete(logs);
  await page.addScriptTag({ content: script });
  await page.evaluate(() => { history.replaceState({}, '', '/timer/?changed=1'); window.dispatchEvent(new Event('focus')); });
  await page.waitForTimeout(1200);
  expect(await events(page)).toEqual([]);
  expect(logs).toHaveLength(1);
});

test('waits for delayed content and disabled controls, ignoring hidden duplicates and timer mutations', async ({ page }) => {
  const logs = await setup(page, () => {
    window.delay = 500;
    const button = document.querySelector('#favorite');
    button.disabled = true;
    const hidden = button.cloneNode(true);
    hidden.id = 'hidden'; hidden.hidden = true; button.after(hidden);
    const page = document.querySelector('.fixture-Page-EnhancedPage');
    page.hidden = true;
    setTimeout(() => { page.hidden = false; }, 400);
    setTimeout(() => { button.disabled = false; }, 1600);
    setInterval(() => { document.querySelector('#unrelated').textContent = String(Date.now()); }, 40);
  });
  await complete(logs);
  expect(await events(page)).toEqual(['nav', 'favorite']);
});

for (const target of ['nav', 'favorite']) {
  test(`stalled ${target} is clicked only once and times out`, async ({ page }) => {
    await page.clock.install();
    const logs = await setup(page, () => { window.hold.nav = true; window.hold.favorite = true; });
    if (target === 'favorite') await page.evaluate(() => document.querySelector('nav').classList.add('collapsed'));
    await page.clock.runFor(31000);
    expect(await events(page)).toEqual([target]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('Stopped after 30 seconds');
    await page.clock.runFor(5000);
    expect(await events(page)).toEqual([target]);
  });
}

for (const problem of ['duplicate-favorite', 'duplicate-nav', 'unknown-nav', 'disabled-nav', 'missing-favorite', 'unknown-sidebar']) {
  test(`fails safely for ${problem}`, async ({ page }) => {
    await page.clock.install();
    const logs = await setup(page);
    await page.evaluate(problem => {
      if (problem === 'duplicate-favorite' || problem === 'duplicate-nav') {
        const el = document.querySelector(problem === 'duplicate-nav' ? '#nav' : '#favorite');
        el.after(el.cloneNode(true));
      } else if (problem === 'unknown-nav') document.querySelector('#nav svg').remove();
      else if (problem === 'disabled-nav') document.querySelector('#nav').disabled = true;
      else if (problem === 'missing-favorite') document.querySelector('#favorite').remove();
      else document.querySelector('#sidebar-slot').innerHTML = '<div class="fixture-SidebarRight">Unknown content</div>';
    }, problem);
    await page.clock.runFor(31000);
    expect(await events(page)).toEqual([]);
    expect(logs[0]).toContain('Stopped after 30 seconds');
  });
}

test('manual pointer interaction cancels a pending transition', async ({ page }) => {
  const logs = await setup(page, () => { window.hold.nav = true; });
  await expect.poll(() => events(page)).toEqual(['nav']);
  await page.locator('#favorite').click();
  await page.waitForTimeout(1000);
  expect(await events(page)).toEqual(['nav', 'favorite']);
  expect(logs.some(s => s.includes('manual panel interaction'))).toBe(true);
  expect(logs.some(s => s.includes('sidebar open;'))).toBe(false);
});

test('keyboard interaction cancels initialization before activating a panel', async ({ page }) => {
  const logs = await setup(page, () => { document.querySelector('nav').classList.add('collapsed'); });
  await page.locator('#favorite').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1100);
  expect(await events(page)).toEqual(['favorite']);
  expect(logs.some(s => s.includes('manual panel interaction'))).toBe(true);
});

test('route exit cancels pending work and re-entry starts a fresh visit, including popstate', async ({ page }) => {
  const logs = await setup(page, () => { window.hold.nav = true; });
  await expect.poll(() => events(page)).toEqual(['nav']);
  await page.evaluate(() => { history.pushState({}, '', '/reports'); window.hold.nav = false; });
  await page.waitForTimeout(700);
  expect(await events(page)).toEqual(['nav']);
  await page.evaluate(() => history.pushState({}, '', '/timer/'));
  await complete(logs);
  expect(await events(page)).toEqual(['nav', 'nav', 'favorite']);
  await page.evaluate(() => { history.pushState({}, '', '/reports'); document.querySelector('#sidebar-slot').replaceChildren(); });
  await page.goBack();
  await expect.poll(() => events(page)).toEqual(['nav', 'nav', 'favorite', 'favorite']);
});

test('initial non-Timer page stays idle, then entering Timer activates', async ({ page }) => {
  const logs = await setup(page, () => {}, '/timer-extra');
  await page.waitForTimeout(1200);
  expect(await events(page)).toEqual([]);
  await page.evaluate(() => history.pushState({}, '', '/timer'));
  await complete(logs);
  expect(await events(page)).toEqual(['nav', 'favorite']);
});

test('unexpected dialog blocks automation', async ({ page }) => {
  const logs = await setup(page, () => {
    const dialog = document.createElement('dialog'); document.body.append(dialog); dialog.showModal();
  });
  await expect.poll(() => logs.length).toBe(1);
  expect(logs[0]).toContain('dialog is open');
  expect(await events(page)).toEqual([]);
});
