# Toggl Auto Favorites

Opens Toggl Track's Favorites sidebar and collapses expanded desktop navigation once per Timer visit.

[Install / update](https://ihoru.github.io/userscripts/toggl-auto-favorites/toggl-auto-favorites.user.js) · [Changelog](CHANGELOG.md) · [Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml)

## Installation and updates

Install Tampermonkey, open the installation link, and confirm installation. Reload Toggl Track. Updates use the same link and arrive through your userscript manager's normal update checks. Current version: **1.0.0**.

## Supported pages and behavior

- Runs on `https://track.toggl.com/timer`, including query parameters and a trailing slash. Injection covers the Track origin so returning from another Toggl page also works; all actions are gated to Timer.
- Waits for the controls, collapses expanded desktop navigation when its toggle is visible, then opens the right sidebar if closed. Each toggle is clicked at most once per visit, after 300 milliseconds of stability; the script confirms the resulting state.
- Leaves correct states alone. Hidden mobile navigation is untouched. The Favorites widget's own disclosure setting is preserved: expand its **Favorites** heading manually if desired.
- Manual interaction with either panel control or a sidebar summary cancels initialization. After completion, both panels remain under your control until a reload or return from another route. Refocusing the tab and changing only query parameters do not restart automation.

## Controls and troubleshooting

There is no added overlay. Disable the script in your userscript manager to turn it off. Console messages prefixed `[Toggl Auto Favorites 1.0.0]` explain completion, manual cancellation, unexpected dialogs, and initialization timeouts. Initialization stops after 30 seconds; reload or revisit Timer to retry.

Toggl's unlabeled buttons require observed component names and navigation geometry. If markup is missing, ambiguous, disabled, obstructed, or unrecognized, the script waits or stops instead of guessing. A Toggl redesign may require an update. The script does not switch Calendar/List/Timesheet modes or activate favorite entries.

No dependencies, credentials, network requests, privileged grants, or persistent storage. Logs contain only script status. DOM observers stop after initialization; lightweight URL detection remains for client-side navigation. Toggl itself may persist panel preferences as it does for manual clicks.

## Validation

Run `npm run test:browser -- toggl-auto-favorites/tests/browser.spec.cjs` from the repository root. Fixtures use invented content and cover desktop/narrow layouts, delayed loading, disabled/ambiguous controls, stalled transitions, manual interaction, duplicate injection, and navigation. Live panel transitions were inspected separately; fixture tests do not prove installation into a userscript manager.
