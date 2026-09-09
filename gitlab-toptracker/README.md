# GitLab → TopTracker

Author: [Igor Polyakov](https://github.com/ihoru). Licensed under [MIT](../LICENSE).

[Changelog](CHANGELOG.md) · [Report a bug](https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml)

Adds **▶ Start TopTracker** below the issue title. **As distributed, this script works only on [PSA GitLab](https://git.psa-europe.com/). It does not run on GitLab.com or other GitLab instances.** See [using another GitLab instance](#using-another-gitlab-instance-or-gitlabcom) to adapt both the script and desktop handler.

Clicking the link asks the desktop integration to start an activity with a description such as `namespace/project!501 Issue title`.

## Requirements

Install and configure the desktop `toptracker-issue://` protocol handler separately, and start TopTracker before using the link. **Installing this userscript does not install the desktop handler.** The browser may ask for permission to open it when you click the link.

Project selection and activity creation are handled by that desktop integration. The userscript cannot confirm that the timer started; verify the project, description, and running timer in TopTracker.

## Desktop handler setup (Linux)

`toptracker-issue://` is a custom local integration, not a protocol installed by TopTracker itself. The existing handler uses Linux D-Bus and AT-SPI desktop accessibility; its working setup is Ubuntu/GNOME on X11. These instructions do not provide a Windows or macOS handler, and other desktop environments have not been verified.

**The handler, its installer, and its `toptracker-control` helper are not included in this repository.** Obtain those files separately from the integration maintainer before following the steps below. There is no handler download or `install.py` in this userscript folder.

### 1. Prepare TopTracker and the helper

- Install TopTracker and sign in. Enable its **activity description on tracking start** setting.
- The handler requires system Python 3 with `dbus`, `gi`, and the `Atspi` 2.0 introspection bindings. Registration requires `update-desktop-database` and `xdg-mime`.
- Obtain `toptracker-issue.py` and the matching `toptracker-control` helper. Place the handler at `~/.local/share/gitlab-toptracker/toptracker-issue.py`.
- In the handler's `main()`, set the `helper` path to your copy of `toptracker-control`. The original points to `Path.home() / 'projects/my/settings/bin/toptracker-control'`; that is an author-specific path. The helper also expects the TopTracker executable at `/usr/bin/toptracker`; adapt that path if your installation differs.
- Fully quit TopTracker and reopen it with `QT_LINUX_ACCESSIBILITY_ALWAYS_ON=1` in its environment, for example `QT_LINUX_ACCESSIBILITY_ALWAYS_ON=1 /usr/bin/toptracker`. Preserve any existing launcher settings when making this persistent.

### 2. Select the TopTracker project

Create or edit `~/.config/toptracker-issue.json`, preserving existing entries:

```json
{
  "default_project": "Your exact TopTracker project name",
  "projects": {
    "group/repository": "Another exact TopTracker project name"
  }
}
```

Use project names exactly as shown in TopTracker. The `projects` mapping overrides the default for a GitLab `namespace/project` (including nested namespaces). The handler does not need a numeric project ID or a GitLab token. Mapping keys do not include the GitLab host: the same namespace/project on two hosts selects the same TopTracker project.

### 3. Register the protocol handler

Back up an existing handler, desktop entry, and project configuration before replacing them. If you received the complete integration bundle with `install.py`, run `/usr/bin/python3 install.py` **from that bundle's directory**, following its README. The inspected installer backs up replaced files and registers the protocol; it does not supply the helper, configure your project mapping, or enable TopTracker accessibility.

For manual registration, create `~/.local/share/applications/toptracker-issue.desktop` with the following contents. Replace `/home/YOUR_USER` with your actual absolute home path; desktop entries do not expand `~` or `$HOME` in `Exec`.

```ini
[Desktop Entry]
Type=Application
Name=Start TopTracker from GitLab
Exec=/usr/bin/python3 "/home/YOUR_USER/.local/share/gitlab-toptracker/toptracker-issue.py" %u
Terminal=false
NoDisplay=true
MimeType=x-scheme-handler/toptracker-issue;
```

Register it and check the association:

```sh
update-desktop-database "$HOME/.local/share/applications"
xdg-mime default toptracker-issue.desktop x-scheme-handler/toptracker-issue
xdg-mime query default x-scheme-handler/toptracker-issue
```

The last command should print `toptracker-issue.desktop`. Refreshing the desktop database is needed for GNOME's application chooser as well as setting the default association.

### 4. Verify before starting real time

This checks URL parsing and prints `example/project!1 Setup check` without accessing TopTracker:

```sh
/usr/bin/python3 "$HOME/.local/share/gitlab-toptracker/toptracker-issue.py" --check \
  'toptracker-issue://start?issue=https%3A%2F%2Fgit.psa-europe.com%2Fexample%2Fproject%2F-%2Fissues%2F1&title=Setup+check'
```

Then install the userscript, reload a supported issue page, stop any existing activity, and click **Start TopTracker** when you intend to track real time. Accept the browser's request to open the handler, then verify the project, full description, and running timer in TopTracker.

`--check` does not validate desktop integration. **`--prepare-only` starts real tracking; it is not a dry run.** TopTracker can start its timer before the handler finishes filling the description. If that step fails, check and correct or stop the timer before retrying. The handler reports errors through desktop notifications and stderr.

## Using another GitLab instance or GitLab.com

**Change both the userscript and the desktop handler.** The distributed userscript's `@match` and the existing handler's `decode_link()` independently restrict the host to `git.psa-europe.com`.

### 1. Change the userscript match

In your userscript manager's editor, replace the existing PSA `@match` line with your HTTPS host:

```javascript
// @match        https://gitlab.example.com/*/-/issues/*
```

For GitLab.com, use:

```javascript
// @match        https://gitlab.com/*/-/issues/*
```

Keep multiple `@match` lines only if you want the script on multiple explicit hosts. Save the script and reload the issue page. The script already derives the issue URL from the current page, so standard `/<namespace>/<project>/-/issues/<number>` routes need no other JavaScript changes. A deployment under an extra URL prefix needs corresponding path handling changes in both the script and handler so the prefix is not mistaken for part of the namespace.

Treat this as a local fork: give it a distinct `@name` and `@namespace`, remove the upstream `@updateURL`, and replace `@downloadURL` with `// @downloadURL  none` to disable automatic updates. Disable the original copy if their match patterns overlap. Otherwise an upstream update can replace your host customization. Merge future upstream changes into the fork manually. See Tampermonkey's [match metadata](https://www.tampermonkey.net/documentation.php#meta:match) and [download/update metadata](https://www.tampermonkey.net/documentation.php#meta:downloadURL).

### 2. Change the handler's host validation

In `toptracker-issue.py`, find this check in `decode_link()`:

```python
if (issue.scheme, issue.netloc, issue.query, issue.fragment) != ('https', 'git.psa-europe.com', '', ''):
    raise ValueError('Only PSA GitLab issue URLs are supported.')
```

Replace it with an explicit allowlist for the hosts you enabled above:

```python
allowed_hosts = {'gitlab.example.com'}  # Use {'gitlab.com'} for GitLab.com.
if (issue.scheme != 'https' or issue.netloc not in allowed_hosts
        or issue.query or issue.fragment):
    raise ValueError('Only configured HTTPS GitLab issue URLs are supported.')
```

To support multiple hosts, list each in `allowed_hosts` and add its matching `@match` line. Keep the remaining URL, issue-path, and title validation. Update the project mapping to your TopTracker project names, then rerun `--check` with an encoded issue URL on your chosen host. Confirm the resulting namespace/project and title before a live test.

The browser and TopTracker still run on your own computer even when GitLab is hosted in the cloud. Install the protocol handler on that computer, **not on the GitLab server**. Alternate hosts and their current issue-page layouts have not been live-tested with this integration.

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
