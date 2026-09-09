"""Render catalog release summaries from userscript metadata and changelogs."""
import argparse
import html
import re
from pathlib import Path

from validate import metadata


def release_html(source, changelog):
    version = metadata(source)['version']
    section = re.search(r'^## ' + re.escape(version) + r'(?: — ([^\n]+))?\s*\n(.*?)(?=^## |\Z)', changelog, re.M | re.S)
    if not section:
        raise ValueError(f'Missing release notes for {version}')
    bullets = re.findall(r'^- (.+)$', section[2], re.M)
    if not bullets:
        raise ValueError(f'No release bullets for {version}')
    date = f' · {html.escape(section[1])}' if section[1] else ''
    items = ''.join(f'<li>{html.escape(line)}</li>' for line in bullets)
    return f'<section class="release" aria-label="Latest release"><h4>Version {html.escape(version)}{date}</h4><details><summary>Latest changes</summary><ul>{items}</ul></details></section>'


def render(root, page):
    pattern = r'<!-- release:([^\s]+) -->.*?<!-- /release -->'
    seen = set()

    def replace(match):
        path = match[1]
        source = (root / path).resolve()
        if not source.is_relative_to(root.resolve()) or not path.endswith('.user.js'):
            raise ValueError(f'Invalid release source: {path}')
        if path in seen:
            raise ValueError(f'Duplicate release summary: {path}')
        seen.add(path)
        summary = release_html(source.read_text(), source.with_name('CHANGELOG.md').read_text())
        return f'<!-- release:{path} -->\n        {summary}\n        <!-- /release -->'

    result = re.sub(pattern, replace, page, flags=re.S)
    scripts = {str(p.relative_to(root)) for p in root.glob('*/*.user.js')}
    if seen != scripts:
        raise ValueError('Each userscript needs exactly one release summary marker in index.html')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true', help='Update index.html; default checks for stale summaries')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    page = root / 'index.html'
    expected = render(root, page.read_text())
    if args.write:
        page.write_text(expected)
    elif page.read_text() != expected:
        raise SystemExit('Catalog release summaries are stale. Run python3 ci/catalog.py --write')
    print('Catalog release summaries match script versions and changelogs')
