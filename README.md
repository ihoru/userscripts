# Useful userscripts

By [Igor Polyakov](https://github.com/ihoru).

Small browser scripts that automate repetitive tasks. Browse the [script catalog](https://ihoru.github.io/userscripts/) for descriptions and **Install / update** links.

## Scripts

| Name | Description | Install |
| --- | --- | --- |
| [DuoCards Auto Import](duocards-auto-import/) | Saves loaded import cards, resets duplicate progress, and logs completed actions. | [Install / update](https://ihoru.github.io/userscripts/duocards-auto-import/duocards-auto-import.user.js) |

## How to use

Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome, then click a script's Install / update link and confirm in Tampermonkey. If Chrome displays source code, use Tampermonkey Dashboard → Utilities → Import from URL with the same link. Enable Chrome's Allow User Scripts setting if requested. Reload the target website before starting a new import.

Tampermonkey checks the public script URLs for updates on its normal schedule when update checks are enabled. **Older ZIP installations need one manual update** to replace their disabled-update metadata. Script identity stays unchanged, so this updates the existing script. Future releases increment `@version`; never change `@name` or `@namespace` merely to release an update.

## Repository and publishing

Each script has a separate folder with source, tests, and documentation. Add future scripts as separate folders and add an entry to this README and `index.html`.

GitHub Pages publishes the root of `main` at https://ihoru.github.io/userscripts/. The `.nojekyll` file keeps publishing static. There is no framework, build dependency, or analytics.

When releasing a script: increment `@version`, run its tests, and commit and push. GitHub Pages publishes the updated script; Tampermonkey retrieves it at its next update check. Keep the `@updateURL` and `@downloadURL` pointed at the stable Pages URL, not a commit-specific URL. Verify Pages deployment before announcing a release.
