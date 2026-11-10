# Repository guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md) before creating, modifying, testing, or releasing userscripts. It defines repository requirements, conditional automation patterns, and release verification. Consult the relevant script README and changelog for site-specific behavior.

When bumping a userscript version, update its changelog and README catalog row, then run `python3 ci/catalog.py --write` to regenerate the public catalog. After deployment, verify the published catalog and install link show the new version.
