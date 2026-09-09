import subprocess
import tempfile
import unittest
from pathlib import Path

from validate import SITE, validate


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = 'example/example.user.js'
        self.script = self.root / self.path
        self.script.parent.mkdir()
        self.script.write_text('\n'.join([
            '// ==UserScript==', '// @name Example', '// @namespace test',
            '// @version 1.0.0', '// @author Author', '// @description Description',
            '// @match https://example.com/*', '// @license MIT',
            '// @updateURL ' + SITE + self.path,
            '// @downloadURL ' + SITE + self.path,
            '// ==/UserScript==', 'void 0;',
        ]))
        (self.script.parent / 'CHANGELOG.md').write_text('## 1.0.0\nInitial release.\n## 1.0.1\nFix.\n')
        (self.root / 'index.html').write_text(f'<a href="{self.path}">Install</a>')
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'Initial')
        self.base = self.git('rev-parse', 'HEAD').strip()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], text=True)

    def edit(self, before, after):
        self.script.write_text(self.script.read_text().replace(before, after))

    def test_unchanged_script_passes(self):
        validate(self.root, self.base)

    def test_changed_script_without_bump_fails(self):
        self.edit('void 0;', 'void 1;')
        with self.assertRaisesRegex(ValueError, 'needs a version greater'):
            validate(self.root, self.base)

    def test_changed_script_with_bump_passes(self):
        self.edit('1.0.0', '1.0.1')
        self.edit('void 0;', 'void 1;')
        validate(self.root, self.base)

    def test_version_decrease_fails(self):
        self.edit('1.0.0', '0.9.0')
        (self.script.parent / 'CHANGELOG.md').write_text('## 0.9.0\n')
        with self.assertRaisesRegex(ValueError, 'needs a version greater'):
            validate(self.root, self.base)

    def test_bad_update_url_fails(self):
        self.edit('// @updateURL ' + SITE, '// @updateURL https://wrong.example/')
        with self.assertRaisesRegex(ValueError, 'stable public URL'):
            validate(self.root, self.base)

    def test_missing_metadata_fails(self):
        self.edit('// @author Author', '')
        with self.assertRaisesRegex(ValueError, 'Missing @author'):
            validate(self.root, self.base)

    def test_broken_install_link_fails(self):
        (self.root / 'index.html').write_text('<a href="missing.user.js">Install</a>')
        with self.assertRaisesRegex(ValueError, 'Broken local catalog link'):
            validate(self.root, self.base)

    def test_missing_changelog_version_fails(self):
        self.edit('1.0.0', '1.0.2')
        with self.assertRaisesRegex(ValueError, 'missing changelog'):
            validate(self.root, self.base)

    def test_invalid_base_fails_closed(self):
        with self.assertRaises(subprocess.CalledProcessError):
            validate(self.root, 'nonexistent-base')


if __name__ == '__main__':
    unittest.main()
