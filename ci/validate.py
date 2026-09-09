"""Validate public userscripts and reject changed releases without a version bump."""
import argparse
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE = 'https://ihoru.github.io/userscripts/'


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True)


def metadata(source):
    block = re.search(r'^// ==UserScript==\s*\n(.*?)^// ==/UserScript==', source, re.M | re.S)
    if not block:
        raise ValueError('Missing userscript metadata block')
    result = {}
    for key, value in re.findall(r'^//\s+@(\w+)\s+(.+)$', block[1], re.M):
        if key in result and key != 'match':
            raise ValueError(f'Duplicate @{key}')
        result[key] = value.strip()
    for key in ('name', 'namespace', 'version', 'author', 'description', 'match', 'updateURL', 'downloadURL', 'license'):
        if not result.get(key):
            raise ValueError(f'Missing @{key}')
    version(result['version'])
    return result


def version(value):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value):
        raise ValueError('Version must use major.minor.patch integers')
    return tuple(map(int, value.split('.')))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.append(dict(attrs).get('href', ''))


def validate(root, base):
    paths = [p for p in git(root, 'ls-files').splitlines() if p.endswith('.user.js')]
    if not paths:
        raise ValueError('No userscripts found')
    old = {}
    if base:
        git(root, 'rev-parse', '--verify', base + '^{commit}')
        for path in git(root, 'ls-tree', '-r', '--name-only', base).splitlines():
            if path.endswith('.user.js'):
                source = git(root, 'show', f'{base}:{path}')
                # Older releases may predate newly required metadata fields.
                fields = dict(re.findall(r'^//\s+@(\w+)\s+(.+)$', source, re.M))
                old[(fields['name'], fields['namespace'])] = (source, fields['version'])
    identities = set()
    parser = Links()
    parser.feed((root / 'index.html').read_text())
    install_paths = set()
    for link in parser.links:
        if not link or link.startswith('#'):
            continue
        parsed = urlsplit(link)
        if parsed.scheme and not link.startswith(SITE):
            continue
        relative = unquote(urlsplit(link[len(SITE):] if link.startswith(SITE) else link).path)
        target = (root / relative).resolve()
        if not target.is_relative_to(root.resolve()) or not target.exists():
            raise ValueError(f'Broken local catalog link: {link}')
        if relative.endswith('.user.js'):
            install_paths.add(relative)
    for path in paths:
        source = (root / path).read_text()
        fields = metadata(source)
        identity = (fields['name'], fields['namespace'])
        if identity in identities:
            raise ValueError(f'Duplicate script identity: {path}')
        identities.add(identity)
        for key in ('updateURL', 'downloadURL'):
            if fields[key] != SITE + path:
                raise ValueError(f'{path}: @{key} must use its stable public URL')
        if fields['license'] != 'MIT':
            raise ValueError(f'{path}: @license must match repository MIT license')
        if path not in install_paths:
            raise ValueError(f'{path}: missing catalog installation link')
        changelog = (root / path).parent / 'CHANGELOG.md'
        if not changelog.exists() or not re.search(r'^## ' + re.escape(fields['version']) + r'\b', changelog.read_text(), re.M):
            raise ValueError(f'{path}: missing changelog entry for current version')
        if identity in old:
            previous, previous_version = old[identity]
            if source != previous and version(fields['version']) <= version(previous_version):
                raise ValueError(f'{path}: changed script needs a version greater than {previous_version}')
    print(f'Validated {len(paths)} script(s), metadata, changelogs, catalog links and version changes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', help='Base commit to compare; omit only for the first repository commit')
    args = parser.parse_args()
    validate(Path(__file__).resolve().parents[1], args.base)
