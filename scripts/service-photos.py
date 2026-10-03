#!/usr/bin/env python3
"""Photos from Raf's Mac folder "Raf Carpentry Projects/0 Services/<service name>" onto the service pages.

Usage (after staging the folder into the workspace):
    python3 scripts/service-photos.py "/mnt/user-data/uploads/Documents/Raf Carpentry Projects/0 Services"

For every subfolder whose name matches a service (by name or web address, case and spaces ignored):
  - each photo is turned upright, stripped of all metadata (GPS included), resized to 1600 px on the
    long side and lightly corrected (white balance, levels), like the job photos;
  - it is saved as public/images/services/<slug>/<content hash>.jpg (a new name whenever the photo
    changes, so old copies are never served from a cache);
  - the service's "photos" list in content/pages/services.json is rebuilt from the folder, in file-name
    order (name the best one 1.jpg to make it the card photo). An empty folder clears the list.
Optional notes.txt in a folder: one line per photo, "IMG_1234.jpg: what it shows", used as the alt text.
"""
import hashlib
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageOps, ImageStat

try:  # iPhone HEIC files, if the converter is installed (pip install pillow-heif)
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIC = True
except Exception:
    HEIC = False

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICES_JSON = os.path.join(REPO, 'content/pages/services.json')
OUT_ROOT = os.path.join(REPO, 'public/images/services')
EXTS = ('.jpg', '.jpeg', '.png', '.webp') + (('.heic', '.heif') if HEIC else ())


def key(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


def enhance(im, wb=0.35):
    """Gentle grey-world white balance part of the way, auto levels, lift if dark, a touch of contrast."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    means = a.reshape(-1, 3).mean(0)
    gains = 1 + wb * (means.mean() / means - 1)
    im = Image.fromarray(np.clip(a * gains, 0, 255).astype(np.uint8))
    im = ImageOps.autocontrast(im, cutoff=(0.2, 0.4), preserve_tone=True)
    light = ImageStat.Stat(im.convert('L')).mean[0]
    if light < 118:
        im = ImageEnhance.Brightness(im).enhance(min(1.18, 118 / light))
    return ImageEnhance.Contrast(im).enhance(1.04)


def notes_for(folder):
    out = {}
    path = os.path.join(folder, 'notes.txt')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8', errors='ignore'):
            if ':' in line:
                name, text = line.split(':', 1)
                if name.strip() and text.strip():
                    out[name.strip().lower()] = text.strip()
    return out


def main(root):
    data = json.load(open(SERVICES_JSON))
    by_key = {}
    for s in data['services']:
        by_key[key(s['name'])] = s
        by_key[key(s['slug'])] = s
    done = []
    for sub in sorted(os.listdir(root)):
        folder = os.path.join(root, sub)
        if not os.path.isdir(folder):
            continue
        s = by_key.get(key(sub))
        if not s:
            print(f'  ? no service called "{sub}", skipped')
            continue
        notes = notes_for(folder)
        files = sorted(f for f in os.listdir(folder) if f.lower().endswith(EXTS) and not f.startswith('.'))
        skipped = sorted(f for f in os.listdir(folder) if f.lower().endswith(('.heic', '.heif')) and not HEIC)
        out_dir = os.path.join(OUT_ROOT, s['slug'])
        os.makedirs(out_dir, exist_ok=True)
        photos, keep = [], set()
        for f in files:
            im = Image.open(os.path.join(folder, f))
            im = ImageOps.exif_transpose(im).convert('RGB')
            im.thumbnail((1600, 1600), Image.LANCZOS)
            im = enhance(im)
            buf = im.tobytes()
            name = hashlib.sha1(buf).hexdigest()[:10] + '.jpg'
            keep.add(name)
            path = os.path.join(out_dir, name)
            if not os.path.exists(path):
                im.save(path, 'JPEG', quality=86, optimize=True, progressive=True)  # no EXIF passed: GPS and all metadata gone
            alt = notes.get(f.lower()) or f"{s['name']} by Raf Carpentry"
            photos.append({'src': f"/images/services/{s['slug']}/{name}", 'w': im.width, 'h': im.height, 'alt': alt})
        for old in os.listdir(out_dir):
            if old.endswith('.jpg') and old not in keep:
                os.remove(os.path.join(out_dir, old))
        if photos:
            s['photos'] = photos
        else:
            s.pop('photos', None)
        done.append(f"{s['name']}: {len(photos)} photo(s)" + (f", {len(skipped)} HEIC skipped (install pillow-heif)" if skipped else ''))
    json.dump(data, open(SERVICES_JSON, 'w'), indent=2, ensure_ascii=False)
    open(SERVICES_JSON, 'a').write('\n')
    print('\n'.join(done) or 'nothing to do')


if __name__ == '__main__':
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
        sys.exit(__doc__)
    main(sys.argv[1])
