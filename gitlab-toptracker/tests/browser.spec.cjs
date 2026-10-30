const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const script = readFileSync(join(__dirname, '../gitlab-toptracker.user.js'), 'utf8');
const origin = 'https://git.psa-europe.com';
const button = '#gitlab-toptracker-start';
const titleSelector = 'h1[data-testid="work-item-title"]';
const titleMarkup = '<h1 data-testid="work-item-title" class="gl-heading-1 !gl-m-0 gl-w-full gl-wrap-anywhere"><span>  Проверить поиск &amp; фильтры #1  </span></h1>';
const title = 'Проверить поиск & фильтры #1';

async function setup(page, path, html = titleMarkup) {
  await page.route(origin + '/**', route => route.fulfill({
    contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>' + html + '</body></html>',
  }));
  await page.goto(origin + path);
  // Respect the userscript's match metadata: injecting unconditionally would
  // miss the original failure where the manager never loads the script.
  const matches = [...script.matchAll(/^\/\/ @match\s+(\S+)/gm)].map(([, pattern]) =>
    new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'));
  if (matches.some(pattern => pattern.test(page.url()))) await page.addScriptTag({ content: script });
}

async function expectLink(page, project, number, expectedTitle = title) {
  const link = page.locator(button);
  await expect(link).toHaveCount(1);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('title', `${project}!${number} ${expectedTitle}`);
  await expect.poll(async () => {
    const url = new URL(await link.getAttribute('href'));
    return { protocol: url.protocol, action: url.host, params: [...url.searchParams] };
  }).toEqual({
    protocol: 'toptracker-issue:', action: 'start',
    params: [['issue', `${origin}/${project}/-/issues/${number}`], ['title', expectedTitle]],
  });
}

test('new work-item page uses its visible title and a handler-compatible encoded URL', async ({ page }) => {
  await setup(page, '/example/team/project/-/work_items/42/?ignored=1#note_9',
    '<h1>Unrelated heading</h1><div hidden><h1 data-testid="work-item-title">Hidden title</h1></div>' + titleMarkup);
  await expectLink(page, 'example/team/project', 42);
  await expect(page.locator(titleSelector + ' + ' + button)).toHaveCount(1);
});

test('legacy issue pages retain their title and protocol behavior', async ({ page }) => {
  await setup(page, '/example/project/-/issues/7/?ignored=1#note_9', '<h1> Legacy\n  issue title </h1>');
  await expectLink(page, 'example/project', 7, 'Legacy issue title');
});

test('waits for a real work-item title and follows edits, empty titles, and visibility', async ({ page }) => {
  await setup(page, '/example/project/-/work_items/42', '<h1>Unrelated heading</h1>');
  await expect(page.locator(button)).toHaveCount(0);
  await page.evaluate(markup => document.body.insertAdjacentHTML('beforeend', markup), titleMarkup);
  await expectLink(page, 'example/project', 42);
  await page.locator(titleSelector + ' span').evaluate(span => { span.firstChild.data = 'Updated\n title'; });
  await expectLink(page, 'example/project', 42, 'Updated title');
  await page.locator(titleSelector).evaluate(heading => { heading.hidden = true; });
  await expect(page.locator(button)).toHaveCount(0);
  await page.locator(titleSelector).evaluate(heading => { heading.hidden = false; });
  await expectLink(page, 'example/project', 42, 'Updated title');
  await page.locator(titleSelector).evaluate(heading => { heading.textContent = '  '; });
  await expect(page.locator(button)).toHaveCount(0);
});

test('moves the existing link when Vue replaces the title and restores removed links', async ({ page }) => {
  await setup(page, '/example/project/-/work_items/42', '<section id="old">' + titleMarkup + '</section><section id="new"></section>');
  await expectLink(page, 'example/project', 42);
  await page.evaluate(() => {
    const heading = document.querySelector('h1');
    document.querySelector('#new').append(heading.cloneNode(true));
    heading.remove();
  });
  await expect(page.locator('#new > h1 + ' + button)).toHaveCount(1);
  await expect(page.locator('#old ' + button)).toHaveCount(0);
  await page.locator(button).evaluate(link => link.remove());
  await expectLink(page, 'example/project', 42);
});

test('initial list-page injection survives client-side navigation and URL-only changes', async ({ page }) => {
  await setup(page, '/example/project/-/work_items', '<h1>Work items</h1>');
  await expect(page.locator(button)).toHaveCount(0);
  await page.evaluate(markup => {
    history.pushState({}, '', '/example/project/-/work_items/42');
    document.body.innerHTML = markup;
  }, titleMarkup);
  await expectLink(page, 'example/project', 42);
  await page.evaluate(() => history.pushState({}, '', '/example/project/-/work_items/43'));
  await expectLink(page, 'example/project', 43);
  await page.goBack();
  await expectLink(page, 'example/project', 42);
  await page.evaluate(() => history.replaceState({}, '', '/example/project/-/merge_requests/42'));
  await expect(page.locator(button)).toHaveCount(0);
  await page.evaluate(() => history.pushState({}, '', '/example/project/-/issues/8'));
  await expectLink(page, 'example/project', 8);
});

test('group work items never generate a project issue URL', async ({ page }) => {
  await setup(page, '/groups/example/team/-/work_items/42');
  await expect(page.locator(button)).toHaveCount(0);
});

test('visibility-hidden titles are ignored and recover when shown', async ({ page }) => {
  await setup(page, '/example/project/-/work_items/42', '<div style="visibility: hidden">' + titleMarkup + '</div>');
  await expect(page.locator(button)).toHaveCount(0);
  await page.locator('div').evaluate(element => { element.style.visibility = 'visible'; });
  await expectLink(page, 'example/project', 42);
});

for (const route of ['issues', 'work_items']) {
  test(`${route}: ambiguous visible titles suppress the link until resolved`, async ({ page }) => {
    await setup(page, `/example/project/-/${route}/42`, titleMarkup + titleMarkup);
    await expect(page.locator(button)).toHaveCount(0);
    await page.locator(titleSelector).last().evaluate(heading => heading.remove());
    await expectLink(page, 'example/project', 42);
  });
}

test('only an explicit click requests the desktop protocol and reinjection keeps one link', async ({ page }) => {
  await setup(page, '/example/project/-/work_items/42');
  await expectLink(page, 'example/project', 42);
  await page.addScriptTag({ content: script });
  await page.evaluate(() => {
    window.openedLinks = [];
    document.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      event.preventDefault();
      openedLinks.push(link.href);
    });
  });
  await expect(page.locator(button)).toHaveCount(1);
  expect(await page.evaluate(() => openedLinks)).toEqual([]);
  const href = await page.locator(button).getAttribute('href');
  await page.locator(button).click();
  expect(await page.evaluate(() => openedLinks)).toEqual([href]);
});

for (const path of ['/work_items/new', '/work_items/0', '/work_items/42/edit', '/issues/new', '/merge_requests/42']) {
  test(`does not activate on unsupported route ${path}`, async ({ page }) => {
    await setup(page, '/example/project/-' + path);
    await expect(page.locator(button)).toHaveCount(0);
  });
}
