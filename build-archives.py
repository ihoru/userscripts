#!/usr/bin/env python3
"""Build reproducible Tampermonkey ZIP imports for each script folder."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


def main():
    root = Path(__file__).resolve().parent
    for source in sorted(root.glob('*/*.user.js')):
        archive = source.with_name(source.name.removesuffix('.user.js') + '.install.zip')
        entry = ZipInfo(source.name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        with ZipFile(archive, 'w') as target:
            target.writestr(entry, source.read_bytes())
        print(archive.relative_to(root))


if __name__ == '__main__':
    main()
