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

## Repository and publishing

Each script has a separate folder with source, tests, and documentation. Add future scripts as separate folders and add an entry to this README and `index.html`.

The **Test and publish** workflow validates pull requests and pushes. Only successful checks on `main` can deploy to https://ihoru.github.io/userscripts/. GitHub Pages uses the Actions publishing source. There is no frontend framework or analytics.

When releasing a script: increment `@version`, run its tests, and commit and push. GitHub Pages publishes the updated script; Tampermonkey retrieves it at its next update check. Keep the `@updateURL` and `@downloadURL` pointed at the stable Pages URL, not a commit-specific URL. Verify Pages deployment before announcing a release.

## Checks and releases

Each script folder must contain a `CHANGELOG.md` entry for its current version. Link the changelog from its README and catalog entry. Keep release history out of the userscript body.

CI runs all `*/*.test.cjs` files, script syntax checks and the validator regression tests. The validator requires metadata (including MIT license), stable public update URLs, existing catalog install links and changelog entries. A changed existing script must increase its `@version` (numeric `major.minor.patch`). Even metadata-only script edits require a version increase; documentation-only changes do not.

For pull requests, compare against the PR base commit; for pushes, compare against the previous branch tip, covering every commit in the push. Manual workflow runs compare against the preceding commit. New scripts must pass all metadata and catalog checks but have no prior version to compare.

Run locally after staging new files:

```sh
python3 ci/validate.py --base HEAD
python3 -m unittest discover -s ci -p 'test_*.py' -v
for script in */*.user.js; do node --check "$script"; done
for test in */*.test.cjs; do node "$test"; done
```

After committing, use `--base HEAD^` to validate that commit. The workflow does not deploy pull requests or non-main manual runs. Failed checks leave the previously published website and scripts in place.

The catalog shows each script's version and latest changelog bullets. After changing a release, run `python3 ci/catalog.py --write` and commit the updated `index.html`. CI rejects stale summaries. For a new script, put a `<!-- release:folder/script.user.js --> … <!-- /release -->` block inside its catalog entry; the renderer fills it from metadata and `CHANGELOG.md`.
