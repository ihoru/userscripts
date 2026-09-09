import tempfile
import unittest
from pathlib import Path

from catalog import release_html, render
from validate import metadata


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.source = (Path(__file__).resolve().parents[1] / 'duocards-auto-import/duocards-auto-import.user.js').read_text()
        self.version = metadata(self.source)['version']

    def test_selects_current_release_and_escapes_content(self):
        notes = f'## {self.version} — 2026-09-09\n\n- Handle <dialog> & alerts.\n\n## 0.1.0\n- Old release.\n'
        result = release_html(self.source, notes)
        self.assertIn(f'Version {self.version} · 2026-09-09', result)
        self.assertIn('Handle &lt;dialog&gt; &amp; alerts.', result)
        self.assertNotIn('Old release', result)

    def test_missing_release_fails(self):
        with self.assertRaisesRegex(ValueError, 'Missing release notes'):
            release_html(self.source, '## 0.0.0\n- Old.\n')

    def test_empty_release_fails(self):
        with self.assertRaisesRegex(ValueError, 'No release bullets'):
            release_html(self.source, f'## {self.version}\n\n')

    def test_stale_summary_replaced_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'example'
            folder.mkdir()
            (folder / 'example.user.js').write_text(self.source)
            (folder / 'CHANGELOG.md').write_text(f'## {self.version}\n- Fixed importing.\n')
            page = '<!-- release:example/example.user.js -->stale<!-- /release -->'
            result = render(root, page)
            self.assertNotIn('stale', result)
            self.assertIn('Fixed importing.', result)
            self.assertEqual(render(root, result), result)
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                render(root, '<p>No marker</p>')
