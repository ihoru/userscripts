# Changelog

## 1.0.4 — 2026-10-26

- Recognize Save repeating task and confirm only This task instead of All tasks.
- Preserve the full-editor exception and manual choices for repeating-task saves; log the task scope correctly.

## 1.0.3 — 2026-10-23

- Remember the collapsed or expanded panel state across reloads and Calendar account pages in the same browser profile.
- Keep panel controls and automation working if browser storage is unavailable.

## 1.0.2 — 2026-10-19

- Recognize Material radio inputs with opacity zero by their visible labels, fixing unrecognized recurring-event dialogs.
- Log each dialog creation and decision change with specific rejection reasons and sanitized control diagnostics.
- Collapse the panel into a tiny dot and expand it without interrupting automation.
- Confirm deletion of only this recurring occurrence, preserving the full-editor exception.

## 1.0.1 — 2026-10-19

- Rename the script to Google Calendar Autoconfirm with namespace su.iho.google-calendar-autoconfirm.
- Support every numeric Google Calendar account slot, including multiple signed-in accounts.
- Identify controls by English accessible names instead of generated radio values or controller IDs; English interface only.

## 1.0.0 — 2026-10-19

- Select This event and confirm recurring-event edits outside the full Google Calendar editor.
- Preserve manual choices in the full editor, after navigation, and during manual dialog interaction.
- Add Pause/Resume, a private bug report draft, and browser regression tests.
