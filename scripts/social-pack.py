"""Post packs for Instagram, TikTok and YouTube Shorts, shown in the Job Kit's Posts screen (/job-kit).

  python3 scripts/social-pack.py scripts/social/<job slug>.json

The recipe (scripts/social/<slug>.json) lists what goes into the video, in order, plus the carousel and the captions:
  "reel": [
    {"photo": "g1.jpg", "secs": 2.4, "move": "in", "title": true},      a job photo (public/images/projects/<slug>/),
                                                                          slow push in ("in"), out ("out") or still
    {"photo": "s1.jpg", "secs": 0.75, "label": "Drawer boxes first"},     a numbered step label on top (01, 02...)
    {"wipe": ["before.jpg", "after.jpg"], "secs": 3.2, "title": true},    before, then a wipe to after (labelled)
    {"mounted": "g1.jpg", "secs": 1.6, "label": "Finished"},             a landscape photo on drafting paper
    {"clip": "<folder under the staged Mac uploads>/IMG_7612.MOV", "from": 12.8, "secs": 8, "title": false},
    {"end": true, "secs": 2.5}                                            the end card: R, name, rafcarpentry.com
  ],
  "carousel": ["g1.jpg", {"photo": "before.jpg", "label": "Before"}, ...]   first one gets the title card
  "captions": {"instagram": "...", "tiktok": "...", "youtube": {"title": "...", "description": "..."}}
  "focus": {"g1.jpg": [0.4, 0.5]}     where to centre the crop (0 to 1, x then y), when the middle cuts something off
  A photo name "src:name.jpg" is a crop made for the post (scripts/social/src/<slug>/), e.g. a sharper version of a
  finished photo with a person cut out; "tag" instead of "label" puts a label on a piece without a step number.

The video is 1080 x 1920, 30 fps, H.264 with a silent sound track: no music goes into the file (the apps' own
licensed sounds are added when posting, see the Posts screen). Clip sound is left out too: these clips have
background sound (talking, maybe a radio) that can't be checked from here. Text sits in the top part of the
frame, clear of the apps' buttons and captions. Writes public/social/<slug>/ (reel, carousel, poster; file names
carry a content hash) and content/social/<slug>.json, which /job-kit reads at build."""
import hashlib, io, json, os, shutil, subprocess, sys, tempfile
from datetime import date
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGED = '/mnt/user-data/uploads/Documents/Raf Carpentry Projects'
W, H, FPS = 1080, 1920, 30
PAPER, INK, ACCENT, MUTED, MOUNT = (241, 242, 239), (22, 25, 28), (37, 71, 208), (79, 85, 91), (251, 251, 249)
FONTS = os.path.join(REPO, 'src/fonts/og')
display = lambda s: ImageFont.truetype(f'{FONTS}/Bricolage-650.ttf', s)
sans = lambda s: ImageFont.truetype(f'{FONTS}/Geist-450.ttf', s)
mono = lambda s: ImageFont.truetype(f'{FONTS}/GeistMono-400.ttf', s)
R_INK = Image.open(os.path.join(REPO, 'scripts/social/r-ink.png')).convert('RGBA')
LEFT, TOP = 64, 250  # text keeps to the top left: the apps put their buttons on the right and captions at the bottom

recipe_path = sys.argv[1]
R = json.load(open(recipe_path))
slug = R['slug']
photos_dir = os.path.join(REPO, 'public/images/projects', slug)
focus = R.get('focus', {})
tmp = tempfile.mkdtemp(prefix='social-')


def photo(name):
    # "src:name.jpg" is a crop made for the post from an original photo (scripts/social/src/<slug>/), e.g. with a person cut out
    path = os.path.join(REPO, 'scripts/social/src', slug, name[4:]) if name.startswith('src:') else os.path.join(photos_dir, name)
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')


def wrap(text, font, width):
    words, lines, line = text.split(), [], ''
    for w in words:
        t = f'{line} {w}'.strip()
        if font.getlength(t) <= width or not line:
            line = t
        else:
            lines.append(line)
            line = w
    return lines + ([line] if line else [])


def card(lines, x=LEFT, y=TOP, size=(W, H)):
    """Paper card with the job title (display) and the place (mono, blue), on a transparent layer."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    big = size[1] > 1500  # the video frame; the carousel is a little smaller
    tf, pf = display(92 if big else 76), mono(40 if big else 34)
    lh = 100 if big else 84
    tl = wrap(lines[0], tf, size[0] - 2 * x - 64)
    th = lh * len(tl)
    w = max(max(tf.getlength(t) for t in tl), pf.getlength(lines[1])) + 64
    h = th + 30 + (54 if big else 46) + 34
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle((x + 4, y + 12, x + w + 4, y + h + 12), fill=(0, 0, 0, 70))
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(layer)
    d.rectangle((x, y, x + w, y + h), fill=PAPER + (255,))
    for i, t in enumerate(tl):
        d.text((x + 32, y + 22 + i * lh), t, font=tf, fill=INK)
    d.text((x + 32, y + 22 + th + 20), lines[1], font=pf, fill=ACCENT)
    return layer


def tag(text, num=None, x=LEFT, y=TOP, size=(W, H)):
    """Small paper tag: a step number in blue and its name, or Before / After."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    big = size[1] > 1500
    f = mono(46 if big else 38)
    th = 92 if big else 78
    n = f'{num:02d}  ' if num else ''
    w = f.getlength(n + text) + 52
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle((x + 3, y + 8, x + w + 3, y + th + 8), fill=(0, 0, 0, 60))
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(layer)
    d.rectangle((x, y, x + w, y + th), fill=PAPER + (255,))
    d.text((x + 26, y + (th - (52 if big else 44)) // 2), n, font=f, fill=ACCENT)
    d.text((x + 26 + f.getlength(n), y + (th - (52 if big else 44)) // 2), text, font=f, fill=INK)
    return layer


def graph_paper(size=(W, H)):
    """The site's drafting paper: paper colour with a faint 40 px grid."""
    im = Image.new('RGB', size, PAPER)
    d = ImageDraw.Draw(im)
    for x in range(0, size[0], 40):
        d.line((x, 0, x, size[1]), fill=(228, 230, 225))
    for y in range(0, size[1], 40):
        d.line((0, y, size[0], y), fill=(228, 230, 225))
    return im


def cover_box(src, aspect, fx=0.5, fy=0.5):
    """The largest box of the given width/height ratio inside the photo, centred on (fx, fy)."""
    sw, sh = src.size
    if sw / sh > aspect:
        bw, bh = sh * aspect, sh
    else:
        bw, bh = sw, sw / aspect
    cx = min(max(fx * sw, bw / 2), sw - bw / 2)
    cy = min(max(fy * sh, bh / 2), sh - bh / 2)
    return cx, cy, bw, bh


def kb_frame(src, t, move, fx, fy, size=(W, H)):
    """One frame of a slow push (in or out) over a photo, t from 0 to 1, with sub-pixel smooth framing."""
    cx, cy, bw, bh = cover_box(src, size[0] / size[1], fx, fy)
    z = {'in': 1 + 0.07 * t, 'out': 1.07 - 0.07 * t}.get(move, 1.0)
    w, h = bw / z, bh / z
    return src.resize(size, Image.LANCZOS, box=(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))


def mounted(src, label=None, size=(W, H), t=0.0):
    """A landscape photo on a white mount on drafting paper, like the site."""
    im = graph_paper(size)
    pw = size[0] - 2 * 72
    ph = round(pw * src.height / src.width)
    z = 1 + 0.04 * t
    cw, ch = src.width / z, src.height / z
    pic = src.resize((pw, ph), Image.LANCZOS, box=((src.width - cw) / 2, (src.height - ch) / 2, (src.width + cw) / 2, (src.height + ch) / 2))
    x, y = 72, (size[1] - ph) // 2
    sh = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((x - 14, y - 14 + 22, x + pw + 14, y + ph + 14 + 22), fill=(0, 0, 0, 80))
    im = Image.alpha_composite(im.convert('RGBA'), sh.filter(ImageFilter.GaussianBlur(26)))
    d = ImageDraw.Draw(im)
    d.rectangle((x - 14, y - 14, x + pw + 14, y + ph + 14), fill=MOUNT, outline=(200, 202, 198))
    im.paste(pic, (x, y))
    if label:
        d.text((x - 14, y + ph + 40), label, font=mono(32), fill=MUTED)
    return im.convert('RGB')


def end_card():
    im = graph_paper().convert('RGBA')
    r = R_INK.resize((int(R_INK.width * 0.62), int(R_INK.height * 0.62)), Image.LANCZOS)
    im.alpha_composite(r, ((W - r.width) // 2, 560))
    d = ImageDraw.Draw(im)
    for text, font, fill, y in [('Raf Carpentry', display(92), INK, 1000), ('Fitted furniture in London', sans(46), MUTED, 1118), ('rafcarpentry.com', mono(46), ACCENT, 1210)]:
        d.text(((W - font.getlength(text)) / 2, y), text, font=font, fill=fill)
    return im.convert('RGB')


def write_frames(frames, out):
    """Pipe PIL frames into an intermediate H.264 file (same settings for every piece, so they join cleanly)."""
    p = subprocess.Popen(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes())
    p.stdin.close()
    if p.wait():
        sys.exit(f'ffmpeg failed on {out}')


def over(base, layer):
    if layer is None:
        return base
    return Image.alpha_composite(base.convert('RGBA'), layer).convert('RGB')


title_layer = card([R['title'], R['place']])
pieces, step, seconds = [], 0, 0.0
for i, seg in enumerate(R['reel']):
    out = os.path.join(tmp, f'{i:02d}.mp4')
    n = round(seg['secs'] * FPS)
    seconds += n / FPS
    layer = title_layer if seg.get('title') else None
    if seg.get('label') and not seg.get('mounted'):
        step += 1
        layer = tag(seg['label'], step)
    if seg.get('tag'):  # a label without a step number, e.g. "In the kitchen bay"
        layer = tag(seg['tag'])
    if 'photo' in seg:
        src = photo(seg['photo'])
        fx, fy = focus.get(seg['photo'], [0.5, 0.5])
        write_frames((over(kb_frame(src, k / max(1, n - 1), seg.get('move', 'in'), fx, fy), layer) for k in range(n)), out)
    elif 'mounted' in seg:
        src = photo(seg['mounted'])
        write_frames((mounted(src, seg.get('label'), t=k / max(1, n - 1)) for k in range(n)), out)
    elif 'wipe' in seg:
        a, b = photo(seg['wipe'][0]), photo(seg['wipe'][1])
        fx, fy = focus.get(seg['wipe'][0], [0.5, 0.5])
        fa, fb = kb_frame(a, 0, 'still', fx, fy), kb_frame(b, 0, 'still', fx, fy)
        la, lb = seg.get('labels', ['Before', 'After'])
        ta, tb = tag(la, y=TOP + 330), tag(lb, y=TOP + 330)
        hold, sweep = 0.3, 0.25  # share of the piece: before alone, then the wipe, then after
        frames = []
        for k in range(n):
            t = k / max(1, n - 1)
            s = min(1, max(0, (t - hold) / sweep))
            s = s * s * (3 - 2 * s)
            x = round(W * s)
            f = fa.copy()
            if x:
                f.paste(fb.crop((0, 0, x, H)), (0, 0))
                ImageDraw.Draw(f).rectangle((x - 3, 0, x + 3, H), fill=PAPER)
            f = over(f, tb if s >= 1 else ta)
            frames.append(over(f, layer))
        write_frames(frames, out)
    elif seg.get('end'):
        e = end_card()
        write_frames((e for _ in range(n)), out)
    elif 'clip' in seg:
        src = os.path.join(STAGED, seg['clip'])
        vf = f'scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps={FPS},format=yuv420p'
        cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(seg.get('from', 0)), '-t', str(n / FPS), '-i', src]
        if layer is not None:
            png = os.path.join(tmp, f'{i:02d}.png')
            layer.save(png)
            cmd += ['-i', png, '-filter_complex', f'[0:v]{vf}[v];[v][1:v]overlay=0:0,format=yuv420p']
        else:
            cmd += ['-vf', vf]
        subprocess.run(cmd + ['-an', '-frames:v', str(n), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', out], check=True)
    else:
        sys.exit(f'Unknown piece: {seg}')
    pieces.append(out)

# Join, add a silent sound track (some apps want one), finish for phones.
lst = os.path.join(tmp, 'list.txt')
open(lst, 'w').write(''.join(f"file '{p}'\n" for p in pieces))
joined = os.path.join(tmp, 'reel.mp4')
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
                '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                '-r', str(FPS), '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', joined], check=True)

h8 = lambda path: hashlib.sha1(open(path, 'rb').read()).hexdigest()[:8]
out_dir = os.path.join(REPO, 'public/social', slug)
if os.path.isdir(out_dir):
    shutil.rmtree(out_dir)
os.makedirs(out_dir)
reel_name = f'reel-{h8(joined)}.mp4'
shutil.copy(joined, os.path.join(out_dir, reel_name))

# Poster for the app's list: the first frame, smaller.
first = subprocess.check_output(['ffmpeg', '-nostdin', '-v', 'error', '-ss', '0.8', '-i', joined, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'])
poster = Image.open(io.BytesIO(first)).convert('RGB').resize((540, 960), Image.LANCZOS)
pp = os.path.join(tmp, 'poster.jpg')
poster.save(pp, quality=82, progressive=True, optimize=True)
poster_name = f'poster-{h8(pp)}.jpg'
shutil.copy(pp, os.path.join(out_dir, poster_name))

# Carousel: 1080 x 1350 (Instagram's 4:5), up to 10 slides.
CW, CH = 1080, 1350
slides = []
for k, s in enumerate(R.get('carousel', [])[:10]):
    s = {'photo': s} if isinstance(s, str) else s
    src = photo(s['photo'])
    if src.width > src.height:
        im = mounted(src, s.get('label'), size=(CW, CH))
    else:
        fx, fy = focus.get(s['photo'], [0.5, 0.5])
        im = kb_frame(src, 0, 'still', fx, fy, size=(CW, CH))
        if s.get('label'):
            im = over(im, tag(s['label'], x=48, y=300 if k == 0 else 48, size=(CW, CH)))
    if k == 0:
        im = over(im, card([R['title'], R['place']], x=48, y=48 if src.width <= src.height else 60, size=(CW, CH)))
    path = os.path.join(tmp, f'slide-{k + 1:02d}.jpg')
    im.save(path, quality=90, progressive=True, optimize=True)
    name = f'slide-{k + 1:02d}-{h8(path)}.jpg'
    shutil.copy(path, os.path.join(out_dir, name))
    slides.append({'src': f'/social/{slug}/{name}', 'w': CW, 'h': CH})

reel_path = os.path.join(out_dir, reel_name)
meta = {
    'slug': slug,
    'title': R['title'],
    'place': R['place'],
    'job': f'/portfolio/{slug}',
    'made': date.today().isoformat(),
    'video': {'src': f'/social/{slug}/{reel_name}', 'secs': round(seconds, 1), 'bytes': os.path.getsize(reel_path), 'w': W, 'h': H},
    'poster': f'/social/{slug}/{poster_name}',
    'carousel': slides,
    'captions': R['captions'],
    'sound': R.get('sound', 'silent'),
}
os.makedirs(os.path.join(REPO, 'content/social'), exist_ok=True)
json.dump(meta, open(os.path.join(REPO, 'content/social', f'{slug}.json'), 'w'), indent=2, ensure_ascii=False)
shutil.rmtree(tmp)
print(f"{slug}: {seconds:.1f} s, {os.path.getsize(reel_path) / 1e6:.1f} MB, {len(slides)} slides")
