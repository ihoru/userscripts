const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: '.', testMatch: '**/tests/browser.spec.cjs', timeout: 25000, expect: { timeout: 8000 }, use: { browserName: 'chromium', headless: true }, workers: 1, reporter: 'list' });
