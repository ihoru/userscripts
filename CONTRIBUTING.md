# Userscript guidelines

Use this guide when creating, changing, testing, or releasing scripts in this repository. Repository requirements below apply to every script; automation patterns apply when a script performs multi-step actions. Use [DuoCards Auto Import](duocards-auto-import/) as a worked example, not a template for site-specific behavior.

## Repository requirements

- Give each script its own folder containing its `.user.js` source, README, changelog, and relevant tests. Document supported pages, activation, controls, limitations, installation, and updates. Add the script to the root README and public catalog.
- Keep `@name` and `@namespace` stable across releases so userscript managers update the installed script. Use numeric `major.minor.patch` versions. Any change to the userscript, including metadata, requires a version increase; documentation-only changes do not.
- Set `@author` to `Igor Polyakov (https://github.com/ihoru)` and `@license` to `MIT`, matching the [repository license](LICENSE). Provide a clear description, appropriate matches, execution timing, and explicit grants.
- Use `https://ihoru.github.io/userscripts/<folder>/<script>.user.js` for both `@updateURL` and `@downloadURL`. Preserve published paths. Use the public catalog as `@homepageURL` and `https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml` as `@supportURL`; explicit support metadata prevents incorrect repository inference.
- Prefer dependency-free JavaScript and the smallest permissions needed. Explain additional dependencies, network access, storage, or privileged grants in the script README. Scripts must not contain credentials.
- Keep user-facing release history in each script's `CHANGELOG.md`, linked from its README and catalog entry. Include an entry for the current version; keep the installed version display synchronized with metadata.

These are contributor requirements, not a claim that CI enforces every item. [The validator](ci/validate.py) is the source of truth for automated metadata, version, changelog, and catalog checks.

## Reliable page automation

- Inspect the live page and its transitions before choosing selectors. Scope DOM reads to the visible relevant form or component; exclude hidden duplicates and unrelated images, flags, suggestions, and dialogs.
- Define precisely when automation is active. For sites with client-side navigation, allow injection on the necessary origin but gate actions by supported route and visible workflow state. Ordinary editing stays manual unless the script explicitly targets it. Avoid duplicate initialization.
- Check required content and loading state, then wait for a short period of stability. Choose and document deadlines for the target workflow. A fallback may act only when the action remains enabled and valid; never override disabled controls.
- Track workflow position and item identity so repeated items remain distinct. Allow one action in flight and require an expected observable transition before another. A click or generic success toast alone is insufficient proof of completion.
- Tie notifications to the current action; stale messages must not confirm new work. Distinguish intermediate empty forms, expected follow-up screens, completion, and unexpected navigation. Pause with a useful explanation on errors, unexpected dialogs, or stalled actions.
- Keep transition logic separable from DOM inspection so it can be exercised without an account. DuoCards' duplicate reset followed by Skip, exact selectors, and timing values are site-specific examples, not requirements for other scripts.

## Controls, logs, and bug reports

- For ongoing automation, show a compact panel with installed version, current status, and Pause/Resume. Preserve Pause across items, define reload behavior, and invalidate pending confirmation after relevant manual edits, skips, or navigation. Panel controls themselves should not count as manual page intervention.
- Describe what the script is waiting for or what stopped it. Log confirmed outcomes once with their workflow position; keep totals based on confirmed results. For batches, offer Collapse/Expand, Clear, and Copy controls. Clearing displayed entries should not silently alter totals.
- Provide Report a bug in an existing panel, pointing to the [issue template](.github/ISSUE_TEMPLATE/bug_report.yml). Prefill its `script`, `environment`, and `page` fields with script name/version, available browser and userscript manager versions, and sanitized page location. Leave unavailable versions explicitly editable rather than guessing; detected browser versions may be reduced by the browser.
- Build report URLs with encoded query parameters and refresh page information after navigation. Include only known nonprivate routes; strip query strings, fragments, and identifiers. Keep credentials, user content, and logs out of automatic report prefills. Open a draft for user review and submission.
- Keep operational logs in the page session by default. Copy only on explicit user action and explain clipboard failures. If a script needs persistent history or remote diagnostics, document the data and behavior before adding them.

## Performance and validation

Coalesce mutation-triggered reads, filter changes caused by the panel, and use slower polling while idle or paused. Capture short-lived relevant notifications without repeatedly scanning the entire page. Stop or gate work when the workflow ends.

Choose tests that can detect the actual failure, not tests that merely restate implementation. For automation, cover delayed content, disabled actions, repeated items, expected and unexpected transitions, stale notifications, manual intervention, Pause/Resume, stalled actions, and batch completion where applicable. Use invented data in fixtures and verify ordinary editing remains manual. Add real browser tests for meaningful DOM/event behavior that unit fixtures cannot establish, including links and controls.

The [publishing workflow](.github/workflows/publish.yml) is the authoritative list of required checks. It runs syntax checks, script tests, validator/catalog tests, and Chromium tests before deployment. Run relevant checks locally; browser fixtures should avoid changing real account data. State clearly which behavior was verified locally, in CI, or on the actual site.

## Release checklist

1. Update the script version and changelog when source or metadata changes. Add or update catalog entries with installation and changelog links. Each entry needs a `<!-- release:folder/script.user.js --> … <!-- /release -->` block for generated version and latest changes.
2. Run `python3 ci/catalog.py --write` after release changes and commit the generated catalog. Stage new files before validation so the validator discovers them. Check the staged diff for unrelated changes.
3. Run the checks below from the repository root. Before committing, `--base HEAD` compares working files with the current commit; after committing use `--base HEAD^`. For a multi-commit release, compare with the actual pre-release base so every change is covered.

   ```sh
   python3 ci/validate.py --base HEAD
   python3 ci/catalog.py
   python3 -m unittest discover -s ci -p 'test_*.py' -v
   for script in */*.user.js; do node --check "$script"; done
   for test in */*.test.cjs; do node "$test"; done
   npm ci --ignore-scripts
   npx playwright install --with-deps chromium
   npm run test:browser
   git diff --cached --check
   ```

4. Commit and push the intended changes. Verify the remote commit and successful checks for that exact commit. Only successful `main` checks deploy Pages; pull requests validate without publishing. Failed checks leave the prior published release in place.
5. After deployment, verify the public script matches the committed source and that catalog installation links and release notes are current. Deliver the verified commit and installation links. Automatic updates arrive on the manager's update schedule; publishing does not prove an installed copy has updated.

For documentation-only work, verify links and run the existing metadata/catalog checks; let the normal publishing workflow run its full checks. No userscript version bump is needed.
