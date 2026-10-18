"""Rebuild the CueLine icons. Requires Pillow only for this development helper."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'public'
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    image = Image.new('RGB', (1024, 1024), '#101218')
    draw = ImageDraw.Draw(image)
    draw.polygon([(312,320),(472,320),(472,400),(392,400),(392,624),(472,624),(472,704),(312,704)], fill='#efb66b')
    draw.polygon([(540,384),(736,512),(540,640)], fill='#efb66b')
    image.resize((size,size), Image.Resampling.LANCZOS).save(root / name)
print('Generated 192px, 512px and 180px icons.')
