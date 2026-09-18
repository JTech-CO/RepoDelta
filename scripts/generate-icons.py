"""Regenerate committed raster icons from public/icons/logo.svg.

Only needed after editing the artwork. Normal npm build/package uses checked-in
assets and needs Node.js only. Optional tooling: requirements-icons.txt.
No network requests or external SVG references are permitted.
"""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'public' / 'icons'
SIZES = (16, 32, 48, 128)


def main() -> None:
    try:
        import cairosvg
        from PIL import Image
    except ImportError as exc:
        raise SystemExit('Install optional tools: python -m pip install -r scripts/requirements-icons.txt') from exc
    source = (ICONS / 'logo.svg').read_bytes()
    # Restrict this offline build input to self-contained static geometry.
    root = ET.fromstring(source)
    allowed = {'svg', 'defs', 'clipPath', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'title', 'desc'}
    for element in root.iter():
        if element.tag.rsplit('}', 1)[-1] not in allowed:
            raise SystemExit('SVG contains unsupported non-geometric content.')
        for key, value in element.attrib.items():
            key = key.rsplit('}', 1)[-1].lower()
            if key.startswith('on') or key in {'href', 'style'}:
                raise SystemExit('SVG event handlers, href and inline styles are not allowed.')
            if 'url(' in value and not value.startswith('url(#'):
                raise SystemExit('SVG external resource references are not allowed.')
    if root.get('viewBox') is None:
        raise SystemExit('SVG must have an explicit viewBox.')
    files = {}
    for size in SIZES:
        # Oversample geometry, then downsample to avoid coarse 16px edges.
        raster = cairosvg.svg2png(bytestring=source, output_width=size * 4, output_height=size * 4)
        image = Image.open(io.BytesIO(raster)).convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
        for suffix in ('png', 'ico'):
            dest = ICONS / f'{size}.{suffix}'
            if suffix == 'png':
                image.save(dest, format='PNG', optimize=True)
            else:
                image.save(dest, format='ICO', sizes=[(size, size)])
            files[dest.relative_to(ROOT).as_posix()] = hashlib.sha256(dest.read_bytes()).hexdigest()
    lock = {'schema': 1, 'source': 'public/icons/logo.svg', 'sourceSha256': hashlib.sha256(source).hexdigest(),
            'sizes': list(SIZES), 'files': files}
    (ROOT / 'scripts' / 'icon-assets.json').write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    print(f'Generated {len(files)} raster files from logo.svg; wrote icon-assets.json.')


if __name__ == '__main__':
    main()
