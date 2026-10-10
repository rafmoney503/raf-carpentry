"""Fetch a job sent from the Job Kit app (rafcarpentry.com/job-kit) out of the private inbox repo and lay it out
like a job folder from Raf's Mac, so the usual steps (contact sheets, photo processing, job JSON, 3D model, blog post)
work on it unchanged.

The inbox (github.com/rafmoney503/raf-job-inbox, private) has one branch per job, job/<id>, holding a folder <id>/ with
before/ build/ finished/ clips/ drawings/, job.json (what, area, month, sizes, notes, every file with its slot) and
notes.txt. Clips arrive in 3 MB pieces (name.mov.part01of05 ...) and are joined here.

  python3 scripts/job-kit-fetch.py --list                 every job in the inbox, newest first
  python3 scripts/job-kit-fetch.py                        the newest job marked "Send to Claude"
  python3 scripts/job-kit-fetch.py alcove finchley        the newest job whose id, title or area has those words
  options: --inbox DIR (clone of the inbox, default ../raf-job-inbox next to this repo, or /home/claude/raf-job-inbox)
           --out DIR   (default /mnt/user-data/uploads/Documents/Raf Carpentry Projects, where staged Mac folders go)

Output: OUT/<YYYY-MM What Area>/ with 0 Before, 1 Finished (finished photos and the reveal clip), 2 Build steps
(stage photos and the other clips), 3 Drawings, notes.txt, photos.txt (file: slot, caption) and job.json.
File times are set to when each photo was taken, as the app strips the photos' hidden data (EXIF, GPS)."""
import json, os, re, shutil, subprocess, sys, tarfile, io
from datetime import datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]


def opt(name, default):
    if name in args:
        i = args.index(name)
        val = args[i + 1]
        del args[i:i + 2]
        return val
    return default


# The clone of the inbox: next to this repo, or where a Claude session clones attached repos.
_near = [os.path.join(os.path.dirname(REPO), 'raf-job-inbox'), '/home/claude/raf-job-inbox']
INBOX = opt('--inbox', next((d for d in _near if os.path.isdir(os.path.join(d, '.git'))), _near[0]))
OUT = opt('--out', '/mnt/user-data/uploads/Documents/Raf Carpentry Projects')
LIST = '--list' in args
words = [a.lower() for a in args if not a.startswith('--')]


def git(*a, binary=False):
    r = subprocess.run(['git', '-C', INBOX, *a], capture_output=True)
    if r.returncode != 0:
        sys.exit(f'git {" ".join(a)} failed: {r.stderr.decode().strip()}')
    return r.stdout if binary else r.stdout.decode()


if not os.path.isdir(os.path.join(INBOX, '.git')):
    sys.exit(f'No clone of the inbox at {INBOX}. Attach rafmoney503/raf-job-inbox to the session and clone it there.')

git('fetch', '-q', '--prune', 'origin', '+refs/heads/job/*:refs/remotes/origin/job/*')
branches = [b.strip() for b in git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/job/').splitlines() if b.strip()]

jobs = []
for b in branches:
    jid = b.split('/', 2)[-1]
    try:
        j = json.loads(git('show', f'{b}:{jid}/job.json'))
    except SystemExit:
        j = {'id': jid, 'what': '(no details yet)', 'area': '', 'month': jid[:7], 'items': [], 'ready': False}
    j['_branch'] = b
    j['_when'] = git('log', '-1', '--format=%cI', b).strip()
    jobs.append(j)
jobs.sort(key=lambda j: j['_when'], reverse=True)

if LIST or not jobs:
    if not jobs:
        print('The inbox has no jobs yet.')
    for j in jobs:
        items = j.get('items', [])
        photos = sum(1 for i in items if i['kind'] == 'photo')
        clips = sum(1 for i in items if i['kind'] == 'video')
        state = f"sent to Claude {j['readyAt'][:10]}" if j.get('ready') else 'still being filled in'
        print(f"{j['id']}\n    {j['what']}, {j['area']} ({j['month']}): {photos} photo{'' if photos == 1 else 's'}, {clips} clip{'' if clips == 1 else 's'}, {state}; last upload {j['_when'][:16]}")
    sys.exit(0)

if words:
    pick = [j for j in jobs if all(w in f"{j['id']} {j['what']} {j['area']}".lower() for w in words)]
else:
    pick = [j for j in jobs if j.get('ready')]
if not pick:
    sys.exit('No job matches. Try --list.')
job = pick[0]
jid = job['id']

# The job's files, straight from git (no checkout needed).
raw = git('archive', '--format=tar', job['_branch'], f'{jid}/', binary=True)
files = {}
with tarfile.open(fileobj=io.BytesIO(raw)) as t:
    for m in t.getmembers():
        if m.isfile():
            files[m.name[len(jid) + 1:]] = t.extractfile(m).read()

# Join clip pieces: name.part01of05 ... name.part05of05 -> name
pieces = {}
for name in list(files):
    m = re.match(r'^(.*)\.part(\d+)of(\d+)$', name)
    if m:
        pieces.setdefault(m.group(1), {})[int(m.group(2))] = (int(m.group(3)), files.pop(name))
incomplete = []
for name, parts in pieces.items():
    total = next(iter(parts.values()))[0]
    if sorted(parts) != list(range(1, total + 1)):
        incomplete.append(f'{name} ({len(parts)} of {total} pieces)')
        continue
    files[name] = b''.join(parts[i][1] for i in range(1, total + 1))

folder = re.sub(r'[/\\:]', '-', f"{job['month']} {job['what']} {job['area']}").strip()
dest = os.path.join(OUT, folder)
if os.path.exists(dest):
    shutil.rmtree(dest)
SUB = {'before': '0 Before', 'finished': '1 Finished', 'build': '2 Build steps', 'drawings': '3 Drawings'}

listing, missing = [], []
for it in job.get('items', []):
    data = files.get(it['path'])
    if data is None:
        missing.append(it['path'])
        continue
    sub = SUB.get(it['section'])
    if it['section'] == 'clips':
        sub = '1 Finished' if it['slot'] == 'reveal' else '2 Build steps'
    name = os.path.basename(it['path'])
    out = os.path.join(dest, sub, name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(data)
    try:
        t = datetime.fromisoformat(it['takenAt'].replace('Z', '+00:00')).timestamp()
        os.utime(out, (t, t))
    except Exception:
        pass
    extra = f": {it['caption']}" if it.get('caption') else ''
    dur = f", {round(it['duration'])} s" if it.get('duration') else ''
    listing.append(f"{sub}/{name}: {it['slotLabel']}{extra}{dur}")

os.makedirs(dest, exist_ok=True)
for name in ('notes.txt', 'job.json'):
    if name in files:
        with open(os.path.join(dest, name), 'wb') as f:
            f.write(files[name])
with open(os.path.join(dest, 'photos.txt'), 'w') as f:
    f.write('\n'.join(listing) + '\n')

print(f"{job['what']}, {job['area']} ({job['month']}) -> {dest}")
print(f"  {len(listing)} files" + ('' if job.get('ready') else '  (not marked "Send to Claude" yet)'))
if missing:
    print(f"  still on the phone or on the way: {len(missing)} ({', '.join(missing[:6])}{'...' if len(missing) > 6 else ''})")
if incomplete:
    print(f"  clips with pieces missing: {', '.join(incomplete)}")
