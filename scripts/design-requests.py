"""Design requests sent from the Job Kit (Designs screen) that still need a design or an update.

A design request is a Job Kit job with kind "design": branch job/design-<id> in the private inbox
(github.com/rafmoney503/raf-job-inbox) holding <id>/job.json (what, area, sizes, design: {brief, options,
changes}), <id>/notes.txt (the same as a brief) and the photos (before/ = the space, drawings/ = sketches and
pictures of what they like). It needs work when it was sent (readyAt) and no design answers that send yet:
content/designs/<code>.json with "request": <id> and "updatedFor" >= readyAt. See scripts/DESIGNS.md.

  python3 scripts/design-requests.py              what needs doing (nothing printed but "Nothing to do." if none)
  python3 scripts/design-requests.py --all        every design request, done or not
  python3 scripts/design-requests.py --json       what needs doing, as JSON (for a scheduled run)
  python3 scripts/design-requests.py --fetch ID   copy one request's brief, job.json and photos to OUT/<id>/
                                                  and print the code to use (its existing one, or a new one)
  options: --inbox DIR (clone of the inbox; default ../raf-job-inbox next to this repo or /home/claude/raf-job-inbox)
           --out DIR   (default /home/claude/design-requests)

A request whose photos are still on the way waits up to 6 hours after it was sent, then is built with what came.
"""
import io, json, os, re, secrets, subprocess, sys, tarfile
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]


def opt(name, default):
    if name in args:
        i = args.index(name)
        val = args[i + 1]
        del args[i:i + 2]
        return val
    return default


_near = [os.path.join(os.path.dirname(REPO), 'raf-job-inbox'), '/home/claude/raf-job-inbox']
INBOX = opt('--inbox', next((d for d in _near if os.path.isdir(os.path.join(d, '.git'))), _near[0]))
OUT = opt('--out', '/home/claude/design-requests')
FETCH = opt('--fetch', None)
ALL = '--all' in args
AS_JSON = '--json' in args
WAIT_HOURS = 6


def git(*a, binary=False, ok=False):
    r = subprocess.run(['git', '-C', INBOX, *a], capture_output=True)
    if r.returncode != 0:
        if ok:
            return None
        sys.exit(f'git {" ".join(a)} failed: {r.stderr.decode().strip()}')
    return r.stdout if binary else r.stdout.decode()


def when(iso):
    try:
        return datetime.fromisoformat(iso.replace('Z', '+00:00'))
    except Exception:
        return None


if not os.path.isdir(os.path.join(INBOX, '.git')):
    sys.exit(f'No clone of the inbox at {INBOX}. Attach rafmoney503/raf-job-inbox to the session and clone it there.')

# Designs already on the site, by the request they answer.
designs = {}
ddir = os.path.join(REPO, 'content/designs')
for f in sorted(os.listdir(ddir)) if os.path.isdir(ddir) else []:
    if f.endswith('.json'):
        d = json.load(open(os.path.join(ddir, f)))
        if d.get('request'):
            designs[d['request']] = d

git('fetch', '-q', '--prune', 'origin', '+refs/heads/job/*:refs/remotes/origin/job/*')
branches = [b.strip() for b in git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/job/').splitlines() if b.strip()]

now = datetime.now(timezone.utc)
requests = []
for b in branches:
    jid = b.split('/', 2)[-1]
    if not jid.startswith('design-'):
        continue
    raw = git('show', f'{b}:{jid}/job.json', ok=True)
    if raw is None:
        continue  # nothing but photos so far
    j = json.loads(raw)
    if j.get('kind') != 'design':
        continue
    have = set(git('ls-tree', '-r', '--name-only', b, f'{jid}/').split())
    have = {p[len(jid) + 1:] for p in have}
    joined = {re.sub(r'\.part\d+of\d+$', '', p) for p in have}
    missing = [i['path'] for i in j.get('items', []) if i['path'] not in joined]
    d = designs.get(jid)
    sent = when(j['readyAt']) if j.get('readyAt') else None
    done_for = when(d['updatedFor']) if d and d.get('updatedFor') else None
    if not sent:
        state = 'not sent yet'
    elif done_for and done_for >= sent:
        state = 'done'
    elif missing and (now - sent).total_seconds() < WAIT_HOURS * 3600:
        state = 'photos on the way'
    else:
        state = 'update' if d else 'new'
    requests.append({
        'id': jid,
        'branch': b,
        'what': j.get('what', ''),
        'area': j.get('area', ''),
        'readyAt': j.get('readyAt'),
        'state': state,
        'code': d['code'] if d else None,
        'photos': len(j.get('items', [])) - len(missing),
        'missing': missing,
        'design': j.get('design', {}),
        'talk': (j.get('notes', {}).get('talk') or '').strip(),
        'sizes': [s for s in j.get('notes', {}).get('sizes', []) if any((s.get(k) or '').strip() for k in ('w', 'h', 'd'))],
    })
requests.sort(key=lambda r: r['readyAt'] or '')
todo = [r for r in requests if r['state'] in ('new', 'update')]


def new_code():
    taken = {d['code'] for d in designs.values()} | {f[:-5] for f in os.listdir(ddir) if f.endswith('.json')} if os.path.isdir(ddir) else set()
    abc = 'abcdefghjkmnpqrstuvwxyz23456789'  # no 0/o, 1/l/i
    while True:
        c = ''.join(secrets.choice(abc) for _ in range(8))
        if c not in taken and not c.isalpha() and not c.isdigit():
            return c


if FETCH:
    pick = [r for r in requests if r['id'] == FETCH] or [r for r in requests if FETCH.lower() in f"{r['id']} {r['what']} {r['area']}".lower()]
    if not pick:
        sys.exit('No design request matches. Try --all.')
    r = pick[-1]
    jid = r['id']
    raw = git('archive', '--format=tar', r['branch'], f'{jid}/', binary=True)
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw)) as t:
        for m in t.getmembers():
            if m.isfile():
                files[m.name[len(jid) + 1:]] = t.extractfile(m).read()
    pieces = {}
    for name in list(files):
        m = re.match(r'^(.*)\.part(\d+)of(\d+)$', name)
        if m:
            pieces.setdefault(m.group(1), {})[int(m.group(2))] = (int(m.group(3)), files.pop(name))
    for name, parts in pieces.items():
        total = next(iter(parts.values()))[0]
        if sorted(parts) == list(range(1, total + 1)):
            files[name] = b''.join(parts[i][1] for i in range(1, total + 1))
    dest = os.path.join(OUT, jid)
    os.makedirs(dest, exist_ok=True)
    for name, data in files.items():
        out = os.path.join(dest, name)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, 'wb') as f:
            f.write(data)
    code = r['code'] or new_code()
    print(f"{r['what']}, {r['area']} -> {dest}")
    print(f"  state: {r['state']}; photos: {r['photos']}" + (f"; still on the phone: {len(r['missing'])}" if r['missing'] else ''))
    print(f"  code: {code}" + ('  (existing: update this design, keep the code)' if r['code'] else '  (new)'))
    print(f"  updatedFor: {r['readyAt']}")
    print(f"  read: {os.path.join(dest, 'notes.txt')} and the photos in {dest}/before and {dest}/drawings")
    sys.exit(0)

show = requests if ALL else todo
if AS_JSON:
    print(json.dumps(show, indent=2))
    sys.exit(0)
if not show:
    print('Nothing to do.' if not ALL else 'No design requests in the inbox yet.')
    sys.exit(0)
for r in show:
    d = r['design'] or {}
    print(f"{r['id']}  [{r['state']}]" + (f"  code {r['code']}" if r['code'] else ''))
    print(f"    {r['what']}, {r['area']}; sent {(r['readyAt'] or '')[:16]}; {r['photos']} photo{'' if r['photos'] == 1 else 's'}" + (f", {len(r['missing'])} still on the phone" if r['missing'] else ''))
    if r['talk']:
        print(f"    said: {r['talk'][:160]}")
    if d.get('brief'):
        print(f"    wants: {d['brief'][:160]}")
    if d.get('options'):
        print(f"    options: {d['options'][:160]}")
    for c in d.get('changes', [])[-3:]:
        print(f"    change {c['at'][:10]}: {c['text'][:160]}")
