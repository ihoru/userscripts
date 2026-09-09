# Personal userscripts

Private source backup for browser userscripts. Scripts run locally in the browser and contain no GitHub credentials. This repository does not store imported vocabulary or account data.

## DuoCards Auto Import

Automatically processes mass imports at https://app.duocards.com/main/card. Ordinary card editing stays manual.

### Install without copying code

1. Install Tampermonkey in Google Chrome if needed.
2. Open `chrome://extensions`, find Tampermonkey, and open **Details**. Enable **Allow access to file URLs**. If your Chrome version shows **Allow User Scripts**, enable that too; older Chrome versions may require **Developer mode** for userscripts.
3. Open `/home/ihoru/projects/my/userscripts/` in your file manager. Drag **duocards-auto-import.user.js** into a Chrome tab.
4. Tampermonkey opens the script preview. Click **Install**.
5. Reload DuoCards once before starting your next import. Avoid reloading an import in progress because the app may lose its queue.

If dragging opens the source instead, use Tampermonkey Dashboard → Utilities → **Import from file** and select the same file. No code copying is needed.

Official help: [script installation](https://www.tampermonkey.net/faq.php?q=Q102), [Chrome userscript permissions](https://www.tampermonkey.net/faq.php#Q209).

### Behavior

- Starts automatically when an import counter is visible; a floating **Pause / Resume** panel shows progress.
- Waits for the selected card image to load and the usage example to be nonempty, then for one second of stable content.
- After 60 seconds, saves whatever is available, but only if Save is enabled. It never changes a disabled button.
- Resets duplicates automatically. In the verified DuoCards flow, reset shows a success message and clears the fields without advancing the counter; the script then clicks Skip to advance that **already-reset** row. It never skips an ordinary unsaved row.
- Waits for each action to finish. If an action stalls for 20 seconds, an unexpected message appears, or Save stays disabled after the content timeout, it pauses with a reason.
- Pause persists across rows. You can handle a troublesome card manually and then Resume. Reloading resets the pause preference.

The script observes the visible page; it does not call private APIs or read your clipboard. UI changes in DuoCards can require a script update. Keep only one enabled copy of the script in Tampermonkey.

### Update

Pull changes into this repository, then drag the updated `.user.js` file into Chrome again and confirm the update/reinstallation preview. Script identity (`@name` and `@namespace`) stays unchanged; releases increment `@version`. Remote update checks are disabled with `@downloadURL none`, so private GitHub authentication is never needed by Tampermonkey.

### Development and verification

Requires Node.js to run the dependency-free tests:

```sh
node duocards-auto-import.test.cjs
node --check duocards-auto-import.user.js
```

Tests cover loading, stability, timeout fallback, disabled buttons, duplicate reset confirmation, advancement, repeated words, click suppression, pause/resume, errors and completion. Live browser validation confirmed reset → success message → empty form → Skip → next row, and normal Save → batch completion. All 13 controller tests passed. A localhost browser fixture running the full script also completed exactly one reset, one confirmed-reset Skip, and one Save, then became idle. Live validation exercised the app controls; the extension installation itself must be verified in Chrome after installation.
