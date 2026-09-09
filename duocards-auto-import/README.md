# DuoCards Auto Import

Author: [Igor Polyakov](https://github.com/ihoru). Licensed under [MIT](../LICENSE).

[Changelog](CHANGELOG.md) · [Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml)

Automatically processes mass imports on the main card screen (`/main/card`) and inside the book/library editor (`/library/edit`). Ordinary card editing stays manual.

## Install without copying code

[Install / update DuoCards Auto Import](https://ihoru.github.io/userscripts/duocards-auto-import/duocards-auto-import.user.js) · [All scripts](https://ihoru.github.io/userscripts/)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome. Enable **Allow User Scripts** if Chrome requests it.
2. Click the Install / update link above, review the preview, and confirm in Tampermonkey.
3. If the link displays source code, open Tampermonkey Dashboard → Utilities → **Import from URL**, paste the same public link, and install.
4. Reload DuoCards before starting your next import. Reloading an active import may lose its queue.

Existing ZIP installations need this update once to enable automatic updates. Keep only one enabled copy of the script.

Official help: [installation](https://www.tampermonkey.net/faq.php?q=Q102), [URL import](https://www.tampermonkey.net/faq.php?locale=en&q=Q106).

### Behavior

- Starts automatically when an import counter is visible; a floating **Pause / Resume** panel shows progress.
- Waits for the selected card image to load and the usage example to be nonempty, then for one second of stable content.
- After 60 seconds, saves whatever is available, but only if Save is enabled. It never changes a disabled button.
- Resets duplicates automatically. In the verified DuoCards flow, reset shows a success message and clears the fields without advancing the counter; the script then clicks Skip to advance that **already-reset** row. It never skips an ordinary unsaved row.
- Waits for each action to finish. If an action stalls for 20 seconds, an error or unrelated dialog appears, or Save stays disabled after the content timeout, it pauses with a reason.
- Pause persists across rows. You can handle a troublesome card manually and then Resume. Reloading resets the pause preference.

The script observes the visible page; it does not call private APIs or read your clipboard. UI changes in DuoCards can require a script update. Keep only one enabled copy of the script in Tampermonkey.

### Update

From version 1.0.4, `@updateURL` and `@downloadURL` use the stable public GitHub Pages script URL. Tampermonkey checks for higher `@version` values on its normal schedule with update checks enabled. No GitHub login or credentials are required. For an immediate update, use the Install / update link above or Tampermonkey's update check.

### Development and verification

From this folder, use Node.js to run the dependency-free tests:

```sh
node duocards-auto-import.test.cjs
node duocards-auto-import.dom.test.cjs
node --check duocards-auto-import.user.js
```

Tests cover loading, stability, timeout fallback, disabled buttons, duplicate reset confirmation, advancement, repeated words, click suppression, pause/resume, errors and completion. Live browser validation confirmed reset → success message → empty form → Skip → next row, and normal Save → batch completion. All 13 controller tests passed. A localhost browser fixture running the full script also completed exactly one reset, one confirmed-reset Skip, and one Save, then became idle. Live validation exercised the app controls; the extension installation itself must be verified in Chrome after installation.

The page log shows completed saves and resets once and keeps entries for the current page session. See the [changelog](CHANGELOG.md) for release history.
