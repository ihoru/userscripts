# GitLab → TopTracker changelog

## 0.1.2 — 2026-10-30

- Support GitLab's new `/work_items/<number>` pages and `work-item-title` heading while retaining legacy issue-page support.
- Keep sending `/issues/<number>` URLs so the existing desktop protocol handler continues to work.
- Follow client-side navigation from project and list pages, refresh changed titles, and reattach the button when GitLab replaces its heading.
- Exclude group work items and hidden or ambiguous titles, and prevent duplicate initialization.

## 0.1.1 — 2026-09-09

- Package the script with installation instructions, a changelog, and a public catalog entry.
- Enable automatic updates through stable GitHub Pages URLs while preserving the existing script identity.
- Add author, MIT license, support and homepage metadata, and disable execution in frames.
- Preserve the supplied Start TopTracker button and protocol-link behavior.

## 0.1.0 — 2026-09-09

- Add Start TopTracker below PSA GitLab issue titles.
- Pass the issue URL and normalized title to the desktop handler for namespace/project!ISSUE TITLE descriptions.
- Refresh the link as the page changes.
