# Useful userscripts

By [Igor Polyakov](https://github.com/ihoru). Licensed under [MIT](LICENSE).

[Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml) using the template; omit vocabulary, account details and private identifiers.

Small browser scripts that automate repetitive tasks. Browse the [script catalog](https://ihoru.github.io/userscripts/) for descriptions and **Install / update** links.

## Scripts

| Name | Description | Install |
| --- | --- | --- |
| [DuoCards Auto Import](duocards-auto-import/) | Saves loaded import cards, resets duplicate progress, and logs completed actions. | [Install / update](https://ihoru.github.io/userscripts/duocards-auto-import/duocards-auto-import.user.js) |

## How to use

Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome, then click a script's Install / update link and confirm in Tampermonkey. If Chrome displays source code, use Tampermonkey Dashboard → Utilities → Import from URL with the same link. Enable Chrome's Allow User Scripts setting if requested. Reload the target website before starting a new import.

Tampermonkey checks the public script URLs for updates on its normal schedule when update checks are enabled. **Older ZIP installations need one manual update** to replace their disabled-update metadata. Script identity stays unchanged, so this updates the existing script. Future releases increment `@version`; never change `@name` or `@namespace` merely to release an update.

## Contributing and publishing

Read the [userscript guidelines](CONTRIBUTING.md) when adding, changing, testing, or releasing a script. They cover repository conventions, reliable automation, user controls, privacy, bug reports, and the release checklist.

The **Test and publish** workflow validates pull requests and pushes. Only successful checks on `main` deploy to [GitHub Pages](https://ihoru.github.io/userscripts/). There is no frontend framework or analytics.
