"""Contact sheets for picking more job photos (staged from the Mac first): numbered thumbnails with time taken, sharpness, and a mark
when the photo is (nearly) the same as one already on the job page."""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ExifTags

U = '/mnt/user-data/uploads/Documents/Raf Carpentry Projects'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Usage: python3 scripts/job-contact-sheets.py OUTDIR "slug=Folder name on the Mac" ...
OUT = sys.argv[1]
JOBS = dict(a.split('=', 1) for a in sys.argv[2:])
TAG = {v: k for k, v in ExifTags.TAGS.items()}
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf') else ImageFont.load_default()


def dhash(im, n=12):
    g = np.asarray(im.convert('L').resize((n + 1, n), Image.LANCZOS), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


def sharp(im):
    g = np.asarray(im.convert('L').resize((600, int(600 * im.height / im.width))), dtype=np.float32)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())


def taken(path):
    try:
        ex = Image.open(path).getexif()
        sub = ex.get_ifd(0x8769)
        when = sub.get(36867) or ex.get(306) or ''
    except Exception:
        when = ''
    # Job Kit photos have no EXIF (the app strips it); scripts/job-kit-fetch.py sets the file time to when they were taken.
    if not when and os.path.basename(os.path.dirname(path)) in ('0 Before', '1 Finished', '2 Build steps', '3 Drawings') and os.path.exists(os.path.join(os.path.dirname(os.path.dirname(path)), 'photos.txt')):
        import time
        when = time.strftime('%Y:%m:%d %H:%M:%S', time.localtime(os.path.getmtime(path)))
    return when


for slug, folder in JOBS.items():
    site = [Image.open(p) for p in glob.glob(f'{REPO}/public/images/projects/{slug}/*.jpg')]
    site_h = [dhash(ImageOps.exif_transpose(s)) for s in site]
    files = sorted(glob.glob(f'{U}/{folder}/*/*.jp*g'))
    rows = []
    for p in files:
        im = ImageOps.exif_transpose(Image.open(p)).convert('RGB')
        im.thumbnail((1000, 1000))
        h = dhash(im)
        d = min((int((h != s).sum()) for s in site_h), default=999)
        rows.append({'path': p, 'sub': p.split('/')[-2][0], 'name': os.path.basename(p), 'taken': taken(p), 'sharp': round(sharp(im)), 'dup': d, 'w': im.width, 'h': im.height})
    rows.sort(key=lambda r: (r['taken'] or 'z', r['name']))
    for i, r in enumerate(rows, 1):
        r['n'] = i
    json.dump(rows, open(f'{OUT}/{slug}.json', 'w'), indent=1)
    # sheets of 20 (5 x 4)
    TW, TH = 300, 300
    for s in range(0, len(rows), 20):
        chunk = rows[s:s + 20]
        sheet = Image.new('RGB', (5 * TW, 4 * (TH + 22)), 'white')
        d = ImageDraw.Draw(sheet)
        for k, r in enumerate(chunk):
            im = ImageOps.exif_transpose(Image.open(r['path'])).convert('RGB')
            im.thumbnail((TW - 6, TH - 6))
            x, y = (k % 5) * TW, (k // 5) * (TH + 22)
            sheet.paste(im, (x + (TW - im.width) // 2, y + (TH - im.height) // 2))
            on = r['dup'] <= 22
            label = f"{r['n']} {'F' if r['sub']=='1' else 'B'} {r['taken'][11:16]} s{r['sharp']}" + (' ON' if on else '')
            d.rectangle([x, y + TH, x + TW, y + TH + 22], fill=(37, 71, 208) if on else (30, 30, 30))
            d.text((x + 5, y + TH + 2), label, fill='white', font=font)
        sheet.save(f'{OUT}/{slug}-{s // 20 + 1}.jpg', quality=80)
    print(slug, len(rows), 'photos;', sum(1 for r in rows if r['dup'] <= 22), 'look like ones on the site')
