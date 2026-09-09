const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const fixture = readFileSync(join(__dirname, 'fixture.html'), 'utf8');
const script = readFileSync(join(__dirname, '../duocards-auto-import.user.js'), 'utf8');
const panel = '#ihoru-duocards-auto-import';

async function start(page, query = '') {
  await page.route('https://app.duocards.com/**', route => route.fulfill({ contentType:'text/html', body:fixture }));
  await page.goto('https://app.duocards.com/library/edit' + query);
  await page.addScriptTag({ content: script });
}

test('delayed picture/example, normal save and final duplicate with brief toast', async ({ page }) => {
  await start(page, '?delay');
  await expect(page.locator(panel)).toContainText('Waiting for picture and example');
  await expect(page.locator(panel)).toContainText('Waiting for example');
  await expect(page.locator(panel)).toContainText('Import finished', { timeout:12000 });
  await expect(page.locator(panel)).toContainText('1/2 Added: calm - peaceful');
  await expect(page.locator(panel)).toContainText('2/2 Progress reset: steady');
  await expect(page.locator(panel)).toContainText('1 added · 1 progress resets');
  await expect(page.locator('#events')).toHaveText('{"saves":1,"resets":1,"skips":1}');
});

test('manual Skip during a pending save never logs Added', async ({ page }) => {
  await start(page, '?hold');
  await expect(page.locator('#events')).toContainText('"saves":1');
  await page.getByRole('button', { name:'Skip', exact:true }).click();
  await expect(page.locator(panel)).toContainText('Paused — manual interaction');
  await expect(page.locator(panel)).not.toContainText('Added:');
  await expect(page.locator(panel)).toContainText('0 added · 0 progress resets');
  await expect(page.locator('#events')).toHaveText('{"saves":1,"resets":0,"skips":1}');
});

test('manual field edits invalidate pending confirmation', async ({ page }) => {
  await start(page, '?hold');
  await expect(page.locator('#events')).toContainText('"saves":1');
  await page.getByLabel('Word', { exact:true }).fill('edited word');
  await expect(page.locator(panel)).toContainText('Paused — manual interaction');
  await expect(page.locator(panel)).not.toContainText('Added:');
});

test('final normal save, version display, collapse, copy and clear', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await start(page, '?single');
  await expect(page.locator(panel)).toContainText('v1.1.0');
  await expect(page.locator(panel)).toContainText('Import finished');
  await expect(page.locator(panel)).toContainText('1/1 Added: calm - peaceful');
  await page.getByRole('button', { name:'Collapse log' }).click();
  await expect(page.locator(panel + ' [role="log"]')).toBeHidden();
  await page.getByRole('button', { name:'Copy log' }).click();
  await expect(page.locator(panel)).toContainText('Log copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('1/1 Added: calm - peaceful');
  await page.getByRole('button', { name:'Expand log' }).click();
  await page.getByRole('button', { name:'Clear log' }).click();
  await expect(page.locator(panel + ' [role="log"]')).toBeEmpty();
  await expect(page.locator(panel)).toContainText('1 added · 0 progress resets');
});

test('real errors pause and never report a successful save', async ({ page }) => {
  await start(page, '?single&error');
  await expect(page.locator(panel)).toContainText('Network error');
  await expect(page.locator(panel)).not.toContainText('Added:');
  await expect(page.locator('#events')).toHaveText('{"saves":1,"resets":0,"skips":0}');
});
