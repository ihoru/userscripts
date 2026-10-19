# Google Calendar Autoconfirm

Automatically select **This event** and press **OK** when Google Calendar asks which occurrence to edit or delete. Changes made in the full event editor stay manual.

**English interface only.** Set Google Calendar's display language to English to use this script.

[Install / update](https://ihoru.github.io/userscripts/google-calendar-autoconfirm/google-calendar-autoconfirm.user.js) · [Changelog](CHANGELOG.md) · [Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml)

## Installation and updates

Current version: **1.0.2**. Install Tampermonkey, open the installation link and confirm, then reload Calendar. The public link becomes available after this version is published. Until then, create a new script in Tampermonkey and paste the local `.user.js` source. Future updates use the same public URL and your manager's update schedule.

## Supported pages and behavior

- Runs on `https://calendar.google.com/calendar/u/<number>/*`, including multiple signed-in accounts such as `/u/0/`, `/u/1/` and `/u/12/`. Non-numeric account routes are excluded.
- Recognizes the English recurring-event heading, the accessible radio names (**This event**, **This and following events**, **All events**) and the **OK** button name (or **Delete** for recurring deletion). Labels resolve through `aria-labelledby`, `aria-label` or associated HTML labels. Generated radio values, controller IDs, CSS classes and option order are not used. Other languages and unrecognized markup stay manual. Recognizes both **Edit recurring event** and **Delete recurring event**. Other confirmations stay manual.
- Waits for enabled, unobstructed controls and 300 ms of stable layout. Selects **This event** through a normal radio click when necessary (including transparent native Material radio inputs with visible labels), waits for the selection, then clicks OK once. Each newly opened dialog is handled independently.
- Any URL containing `/eventedit/` (or ending in `/eventedit`) disables automatic actions. A dialog observed there stays manual even if Calendar changes the URL. Editor provenance also survives a return to the calendar before the dialog appears; a new pointer or keyboard interaction on the calendar with no dialog open ends this protection.
- Manual interaction inside a dialog, or keyboard intervention while it is pending, leaves that dialog under your control. Navigation cancels pending work. Unexpected dialogs or a stalled action pause the script after at most 10 seconds; no repeated OK clicks.

## Controls and privacy

A compact panel shows the installed version, current status, **Pause / Resume**, and **Report a bug**. Use **−** to collapse it into a 14 px dot; click the dot to expand it. Automation, pause state and console logs continue unchanged while collapsed. Reload restores the expanded panel. Pause lasts across dialogs until Resume or reload. Pausing invalidates the current pending dialog; resuming does not take it over. Reload starts enabled. You can also disable the script in Tampermonkey.

Console entries prefixed `[Google Calendar Autoconfirm 1.0.2]` use `console.log` for every newly detected dialog and each change in its decision: ignored, manual, unrecognized, waiting, selecting, confirming, paused or closed. Each dialog has a session-local number. Rejection logs include a specific reason, scope-option names, input opacity/visibility/disabled state and control counts. Repeated polling does not repeat unchanged decisions. Logs also cover hidden, short-lived, paused and editor dialogs; unknown titles/labels, event content, IDs and URLs are excluded. Dialog closure is an observed UI transition, not proof of server persistence. There is no batch, saved history, or event-content logging. The bug report link opens an editable draft with script/browser information and a sanitized route; event IDs, query parameters and fragments are excluded. Enter the userscript manager/version manually.

No dependencies, persistent storage, added network requests, credentials, or privileged grants. A coalesced DOM observer watches for dialogs; idle URL checks run once per second. Panel mutations do not trigger page scans.

## Validation

Run `npm run test:browser -- google-calendar-autoconfirm/tests/browser.spec.cjs` from the repository root. Chromium fixtures reuse the supplied dialog markup with invented page content and cover edits/deletions, transparent radio inputs, panel collapse/expand, decision logging/privacy, selection, confirmation, repeated dialogs, editor exclusions and provenance, navigation, delayed/disabled/hidden/ambiguous controls, manual changes, Pause/Resume, stalls, unexpected dialogs, duplicate injection and report privacy.

The live edit dialog's selectors and transparent radio styling were inspected without changing an event. Recurring deletion was tested only with local fixtures. Automated tests use local fixtures; they do not verify a real Calendar save or installation in a userscript manager.
