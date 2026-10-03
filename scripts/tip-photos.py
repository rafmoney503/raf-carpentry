#!/usr/bin/env python3
"""Photos from Raf's Mac folder "Raf Carpentry Projects/0 Tips/<tip>" onto the Workshop tips page (/tips).

Usage (after staging the folder into the workspace):
    python3 scripts/tip-photos.py "/mnt/user-data/uploads/Documents/Raf Carpentry Projects/0 Tips"

Each subfolder is one tip, named after it ("03 Scribe to an uneven wall with a school compass"; the number
in front is ignored, so the folder still matches if the tips are put in a different order). The name can
also be the tip's web address (scribe-with-a-compass). Same processing as the service photos: upright,
all metadata (GPS) removed, 1600 px, light correction, saved as public/images/tips/<id>/<hash>.jpg, and
the tip's "photos" list in content/pages/tips.json rebuilt from the folder in file-name order.
An empty folder clears the list. notes.txt ("1.jpg: what it shows") gives the descriptions.
"""
import hashlib
import importlib.util
import json
import os
import re
import sys

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('service_photos', os.path.join(HERE, 'service-photos.py'))
sp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sp)

REPO = os.path.dirname(HERE)
TIPS_JSON = os.path.join(REPO, 'content/pages/tips.json')
OUT_ROOT = os.path.join(REPO, 'public/images/tips')


def slugify(s):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', s.lower().replace('×', 'x')))[:60]


def key(s):
    return sp.key(s.replace('×', 'x'))


def main(root):
    data = json.load(open(TIPS_JSON))
    by_key = {}
    for t in data['tips']:
        t_id = slugify(t.get('id') or t['title'])
        by_key[key(t['title'])] = (t, t_id)
        by_key[key(t_id)] = (t, t_id)
    done = []
    for sub in sorted(os.listdir(root)):
        folder = os.path.join(root, sub)
        if not os.path.isdir(folder):
            continue
        name = re.sub(r'^[\d\s.\-_]+', '', sub)
        hit = by_key.get(key(name)) or by_key.get(key(sub))
        if not hit:
            print(f'  ? no tip called "{sub}", skipped')
            continue
        t, t_id = hit
        notes = sp.notes_for(folder)
        files = sorted(f for f in os.listdir(folder) if f.lower().endswith(sp.EXTS) and not f.startswith('.'))
        out_dir = os.path.join(OUT_ROOT, t_id)
        os.makedirs(out_dir, exist_ok=True)
        photos, keep = [], set()
        for f in files:
            im = Image.open(os.path.join(folder, f))
            im = ImageOps.exif_transpose(im).convert('RGB')
            im.thumbnail((1600, 1600), Image.LANCZOS)
            im = sp.enhance(im)
            fname = hashlib.sha1(im.tobytes()).hexdigest()[:10] + '.jpg'
            keep.add(fname)
            path = os.path.join(out_dir, fname)
            if not os.path.exists(path):
                im.save(path, 'JPEG', quality=86, optimize=True, progressive=True)  # no EXIF: GPS and all metadata gone
            photos.append({'src': f'/images/tips/{t_id}/{fname}', 'w': im.width, 'h': im.height, 'alt': notes.get(f.lower()) or t['title']})
        for old in os.listdir(out_dir):
            if old.endswith('.jpg') and old not in keep:
                os.remove(os.path.join(out_dir, old))
        if photos:
            t['photos'] = photos
        else:
            t.pop('photos', None)
        done.append(f"{t['title']}: {len(photos)} photo(s)")
    json.dump(data, open(TIPS_JSON, 'w'), indent=2, ensure_ascii=False)
    open(TIPS_JSON, 'a').write('\n')
    print('\n'.join(done) or 'nothing to do')


if __name__ == '__main__':
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
        sys.exit(__doc__)
    main(sys.argv[1])
