# GitLab → TopTracker

Author: [Igor Polyakov](https://github.com/ihoru). Licensed under [MIT](../LICENSE).

[Changelog](CHANGELOG.md) · [Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml)

Adds **▶ Start TopTracker** below the issue title on `git.psa-europe.com`. Clicking it asks the desktop integration to start an activity with a description such as `namespace/project!501 Issue title`.

## Requirements

Install and configure the desktop `toptracker-issue://` protocol handler separately, and start TopTracker before using the link. **Installing this userscript does not install the desktop handler.** The browser may ask for permission to open it when you click the link.

Project selection and activity creation are handled by that desktop integration. The userscript cannot confirm that the timer started; verify the project, description, and running timer in TopTracker.

## Install without copying code

[Install / update GitLab → TopTracker](https://ihoru.github.io/userscripts/gitlab-toptracker/gitlab-toptracker.user.js) · [All scripts](https://ihoru.github.io/userscripts/)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome. Enable **Allow User Scripts** if Chrome requests it.
2. Click the Install / update link above, review the preview, and confirm in Tampermonkey.
3. If the link displays source code, open Tampermonkey Dashboard → Utilities → **Import from URL**, paste the same public link, and install.
4. Reload a PSA GitLab issue page.

Keep only one enabled copy of the script. Official help: [installation](https://www.tampermonkey.net/faq.php?q=Q102), [URL import](https://www.tampermonkey.net/faq.php?locale=en&q=Q106).

## Usage and behavior

- Open an issue and click **▶ Start TopTracker** below its title.
- The link tooltip previews `namespace/project!ISSUE TITLE`, including nested namespaces. Whitespace in the title is normalized.
- The script passes the issue origin and pathname, without query parameters or fragments, and the normalized title to `toptracker-issue://start` as URL-encoded `issue` and `title` parameters.
- Page changes refresh the link. Missing or empty headings and unsupported issue paths remove it.
- No activity is requested until you click. The script runs outside frames, requires no privileged userscript permissions, and makes no GitLab or TopTracker API calls.

If the browser cannot open the link, check that the desktop protocol handler is installed and registered. For activity errors, check the desktop integration and TopTracker. When reporting a userscript bug, include its version and omit private issue titles and URLs.

## Updates

Existing **0.1.0** installations need one manual installation from the link above to receive the new update metadata. The script name and namespace are preserved so the userscript manager can update the existing installation.

From **0.1.1**, `@updateURL` and `@downloadURL` point to the stable public GitHub Pages script URL. Tampermonkey checks for higher versions on its normal schedule when update checks are enabled. Use Install / update or the manager's update check for an immediate update, then reload the issue page.

## Development and verification

The executable body preserves the supplied script. From the repository root, check its syntax with:

```sh
node --check gitlab-toptracker/gitlab-toptracker.user.js
```

See the root [checks and releases instructions](../README.md#checks-and-releases) for metadata, catalog, and repository regression checks. These checks do not activate a desktop timer or verify the external handler.
