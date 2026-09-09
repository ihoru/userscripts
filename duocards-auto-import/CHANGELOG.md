# DuoCards Auto Import changelog

## 1.1.2 — 2026-09-09

- Handle the native “That's already in the set.” alert during automatic library saves without blocking the import.
- Log and count existing set items separately; allow automatic advancement or click Skip once if the same item remains.
- Preserve other browser alerts and pause for manual acknowledgement.

## 1.1.1 — 2026-09-09

- Point Tampermonkey's bug-report link directly to the repository's bug-report template.
- Add Report a bug to the panel with script version, available browser and manager versions, and a sanitized page location prefilled.

## 1.1.0 — 2026-09-09

- Show the installed version and separate picture, example, saving and finished statuses.
- Add Collapse, Clear and Copy log controls, plus a batch summary of added cards and progress resets.
- Confirm saves only on expected import transitions; pause on manual intervention without reporting an unconfirmed success.
- Require a fresh reset confirmation, including short-lived notifications and the final duplicate in a batch.
- Coalesce page reads and poll less often while idle or paused.
- Add real Chromium regression tests for loading, confirmations, errors and log controls.

## 1.0.5 — 2026-09-09

- Declare the MIT license in script metadata.
- Add this release history and a bug-report template.
- Require tests, valid installation metadata, and version increases before publishing updates.
- Card-import behavior is unchanged.

## 1.0.4 — 2026-09-09

- Enable automatic updates through public GitHub Pages URLs.
- Add the public script catalog and direct installation link.
- Older installations need one manual update to enable future automatic updates.

## 1.0.3 — 2026-09-09

- Continue importing when the book editor is displayed as a dialog.
- Continue past success notifications while still pausing for errors.
- Show a persistent page-session log of completed saves and progress resets.

## 1.0.2 — 2026-09-09

- Support imports inside the book/library editor as well as the main card screen.
- Fix library-editor imports incorrectly appearing idle.

## 1.0.1 — 2026-09-09

- Add author metadata.
- Move the script into its own repository folder.
- Provide ZIP installation when local file previews do not open (later replaced by public installation URLs).

## 1.0.0 — 2026-09-09

- Automatically save imported cards after their picture and example load.
- Save available content after 60 seconds when Save is enabled.
- Reset duplicate progress and advance the confirmed reset with Skip.
- Add Pause/Resume controls and protection against repeated clicks.
