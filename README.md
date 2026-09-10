# Useful userscripts

By [Igor Polyakov](https://github.com/ihoru). Licensed under [MIT](LICENSE).

[Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml) using the template; omit vocabulary, account details and private identifiers.

Small browser scripts that automate repetitive tasks. Browse the [script catalog](https://ihoru.github.io/userscripts/) for descriptions and **Install / update** links.

## Scripts

| Name | Description | Install | Version / Updated |
| --- | --- | --- | --- |
| [Toggl Auto Favorites](toggl-auto-favorites/) | Opens Favorites and collapses expanded desktop navigation once per Timer visit. | [Install / update](https://ihoru.github.io/userscripts/toggl-auto-favorites/toggl-auto-favorites.user.js) | 1.0.0 / 2026-09-10 |
| [DuoCards Auto Import](duocards-auto-import/) | Saves loaded import cards, resets duplicate progress, and logs completed actions. | [Install / update](https://ihoru.github.io/userscripts/duocards-auto-import/duocards-auto-import.user.js) | 1.1.2 / 2026-09-09 |
| [GitLab → TopTracker](gitlab-toptracker/) | Adds a Start TopTracker link only on [git.psa-europe.com](https://git.psa-europe.com/); requires a separate desktop handler. See [handler setup](gitlab-toptracker/README.md#desktop-handler-setup-linux) and [other GitLab hosts](gitlab-toptracker/README.md#using-another-gitlab-instance-or-gitlabcom). | [Install / update](https://ihoru.github.io/userscripts/gitlab-toptracker/gitlab-toptracker.user.js) | 0.1.1 / 2026-09-09 |

## How to use

Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome, then click a script's Install / update link and confirm in Tampermonkey. If Chrome displays source code, use Tampermonkey Dashboard → Utilities → Import from URL with the same link. Enable Chrome's Allow User Scripts setting if requested. Reload the target website after installation or an update. Finish any active DuoCards import before reloading so you do not lose its queue.

Tampermonkey checks the public script URLs for updates on its normal schedule when update checks are enabled. **Older ZIP installations need one manual update** to replace their disabled-update metadata. Script identity stays unchanged, so this updates the existing script. Future releases increment `@version`; never change `@name` or `@namespace` merely to release an update.

## Contributing and publishing

Read the [userscript guidelines](CONTRIBUTING.md) when adding, changing, testing, or releasing a script. They cover repository conventions, reliable automation, user controls, privacy, bug reports, and the release checklist.

The **Test and publish** workflow validates pull requests and pushes. Only successful checks on `main` deploy to [GitHub Pages](https://ihoru.github.io/userscripts/). There is no frontend framework or analytics.
