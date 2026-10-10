"""Trim the grey band under a model screenshot and fit it on white at the poster size.

    python3 scripts/poster-fit.py <in.png> <out.jpg> <W> <H>      1600 1200 for tall pieces, 1600 800 for wide ones
(after scripts/model-poster.mjs)."""
import sys
from PIL import Image

src, out, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGB')
px = im.load()
y = im.height - 1
while y > 0 and px[5, y][0] < 250:
    y -= 1
im = im.crop((0, 0, im.width, y + 1))
c = Image.new('RGB', (W, H), 'white')
k = min(W / im.width, H / im.height)
im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
c.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
c.save(out, quality=86, optimize=True)
print(out, c.size)
