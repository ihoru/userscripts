# DuoCards Auto Import

Author: [Igor Polyakov](https://github.com/ihoru).

Automatically processes mass imports on the main card screen (`/main/card`) and inside the book/library editor (`/library/edit`). Ordinary card editing stays manual.

## Install without copying code

Use the ZIP import flow; opening or dragging a local `.user.js` file does not reliably launch the installation preview in your Chrome setup.

1. Open **Tampermonkey → Dashboard → Utilities** in Chrome.
2. Under **ZIP**, click **Choose File** (the label can vary by version).
3. Select `duocards-auto-import.install.zip` from this folder. With the local checkout, its full path is `/home/ihoru/projects/my/userscripts/duocards-auto-import/duocards-auto-import.install.zip`.
4. Select the DuoCards script in the import dialog and confirm **Import**.
5. Verify **DuoCards Auto Import** appears enabled in the Dashboard. Reload DuoCards before starting your next import; reloading an import in progress may lose its queue.

If Utilities is hidden, change Tampermonkey's configuration mode to **Beginner** or **Advanced**. If Chrome requires it, enable **Allow User Scripts** on Tampermonkey's extension details page (older versions use **Developer mode**). ZIP import does not require access to file URLs.

The ZIP contains only this userscript, with no extension settings or account data. On GitHub, download the ZIP file using its file download button; do not use GitHub's whole-repository **Download ZIP** as the Tampermonkey import archive.

Official help: [ZIP import](https://www.tampermonkey.net/faq.php?locale=en&q=Q106), [Chrome userscript permissions](https://www.tampermonkey.net/faq.php#Q209).

### Behavior

- Starts automatically when an import counter is visible; a floating **Pause / Resume** panel shows progress.
- Waits for the selected card image to load and the usage example to be nonempty, then for one second of stable content.
- After 60 seconds, saves whatever is available, but only if Save is enabled. It never changes a disabled button.
- Resets duplicates automatically. In the verified DuoCards flow, reset shows a success message and clears the fields without advancing the counter; the script then clicks Skip to advance that **already-reset** row. It never skips an ordinary unsaved row.
- Waits for each action to finish. If an action stalls for 20 seconds, an error or unrelated dialog appears, or Save stays disabled after the content timeout, it pauses with a reason.
- Pause persists across rows. You can handle a troublesome card manually and then Resume. Reloading resets the pause preference.

The script observes the visible page; it does not call private APIs or read your clipboard. UI changes in DuoCards can require a script update. Keep only one enabled copy of the script in Tampermonkey.

### Update

Pull changes into the repository and import the updated `duocards-auto-import.install.zip` through the same ZIP workflow. Confirm replacement/update of the existing script if prompted and keep only one enabled copy. Script identity (`@name` and `@namespace`) stays unchanged; releases increment `@version`. Remote update checks are disabled with `@downloadURL none`, so Tampermonkey never needs GitHub credentials.

### Development and verification

From this folder, use Node.js to run the dependency-free tests:

```sh
node duocards-auto-import.test.cjs
node duocards-auto-import.dom.test.cjs
node --check duocards-auto-import.user.js
```

Tests cover loading, stability, timeout fallback, disabled buttons, duplicate reset confirmation, advancement, repeated words, click suppression, pause/resume, errors and completion. Live browser validation confirmed reset → success message → empty form → Skip → next row, and normal Save → batch completion. All 13 controller tests passed. A localhost browser fixture running the full script also completed exactly one reset, one confirmed-reset Skip, and one Save, then became idle. Live validation exercised the app controls; the extension installation itself must be verified in Chrome after installation.

After editing the script, run `python3 build-archives.py` from the repository root to rebuild the ZIP before committing. The ZIP contents must match the source file.

Version 1.0.2 fixes book-editor imports being incorrectly treated as idle. Full-script DOM regression tests cover both import routes and verify that ordinary library editing stays manual.

Version 1.0.3 excludes the book editor itself from blocking-dialog detection and continues past success notifications. A scrolling page log records completed operations once, for example:

```text
1/2 Added: word - translation
2/2 Progress reset: word
```

Entries use the original card values, survive the reset-to-empty-form transition, and remain visible after the batch finishes. They are kept only in the current page session. Click attempts are not logged as successful; a confirmation or import advancement is required. Picture/example loading waits and real-error pauses remain in place.
