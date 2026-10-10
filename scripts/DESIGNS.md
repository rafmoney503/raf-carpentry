# Making a customer's 3D design from a Job Kit request

Raf fills in a design request in the Job Kit (rafcarpentry.com/job-kit, Designs): photos of the space,
sizes, what the customer wants, the options to show, later any changes. It reaches the private inbox
(rafmoney503/raf-job-inbox, branch `job/design-<id>`). This is how it becomes a private page at
`rafcarpentry.com/d/<code>`, which the app then shows as "Design ready" with Send on WhatsApp.

A scheduled run does this every 2 hours from about 7am to 9pm (London). Raf can also say "make the new design".
In a scheduled run both repos are already cloned: /home/claude/raf-carpentry (push) and /home/claude/raf-job-inbox
(read); the SketchUp and Vercel connectors work there without approvals (tested 10 Oct 2026).

Ground rules: at most 2 requests a run, oldest first. Publish a design only when every option is finished and
the build passes; if anything fails (SketchUp limit reached, a model won't close, the build breaks), publish
nothing for that request and say what stopped it in the final reply: the next run tries again. Change only
content/designs/, public/designs/ and scripts/models/; never the app or other pages.

## 1. Is there anything to do?

```sh
python3 scripts/design-requests.py          # prints "Nothing to do." when there is nothing
```

Nothing to do: stop. No commit, no message.

## 2. Read the request

```sh
python3 scripts/design-requests.py --fetch <id>
```

prints the code to use (the existing one for an update: keep it, the customer already has the link) and
`updatedFor` (the request's `readyAt`, copied exactly). Read `notes.txt` ("Talked through": what Raf said into
the phone's dictation while walking round the room, unsorted and with the odd misheard word, so read it for
meaning and trust typed sizes over spoken ones; then what they want, options, sizes, changes, newest last) and look at every photo in `before/` (the space) and `drawings/` (sketches, pictures
of what they like). For an update, the newest change is what to do; earlier changes are already in.

## 3. Decide what to draw

- One model per option. No options given: one option. At most 3.
- Raf's sizes are the real ones (mm). Anything not given: standard sizes (wardrobes 600 deep, PAX frames
  2364 high, shelves 300 to 350 deep, worktops 900, seats 450 high and 450 to 500 deep, desks 740) and say so in `notes`.
- The room as context (walls, chimney breast, window, boiler) as room parts ("Room: ...", material "Wall"),
  drawn from the photos; never anything that identifies the house or the people.
- Doors and drawers should open (moves in the meta); "Open the doors" / "Close the doors".

## 4. Build each option (same pipeline as the job models, see CLAUDE.md "3D SketchUp models")

1. Trimble SketchUp connector, `build_model`: paste the whole of `scripts/su-helpers.py` at the top, build the
   piece in mm as named parts (plain English names, they show when a part is tapped), end with
   `result = {"readback": export_model(), "pad": "x" * 120000}`. The answer is saved as a file; its path is in the tool result.
2. Write a meta JSON (name, source, materials, moves, dims for Raf's real sizes only, view, actions, secs, apart, omit;
   format in `scripts/su-readback.py` and `scripts/su-to-glb.mjs`).
3. ```sh
   python3 scripts/su-readback.py <saved tool result> <meta.json> scripts/models/design-<code>-<n>.su.json
   node scripts/su-to-glb.mjs scripts/models/design-<code>-<n>.su.json public/designs/<code>/<n>-<hash>.glb
   ```
   `<n>` is a, b, c; `<hash>` is 6 letters or numbers that change with each version (so phones never show an old copy).
   Delete the previous version's files in `public/designs/<code>/` when updating.

## 5. The page: `content/designs/<code>.json`

```json
{
  "code": "<code>",
  "request": "<the request id>",
  "updatedFor": "<readyAt, exactly as printed>",
  "title": "<what, as Raf typed it, tidied: e.g. Wardrobes either side of the chimney breast>",
  "area": "<area only>",
  "made": "<today, YYYY-MM-DD>",
  "options": [
    {
      "name": "Option A: flat doors",
      "text": "<one or two plain sentences on what it is>",
      "model": { "src": "/designs/<code>/a-<hash>.glb",
                 "poster": { "src": "/designs/<code>/a-<hash>.jpg", "w": 1600, "h": 1200, "alt": "3D model of ..." },
                 "shape": "tall" },
      "sizes": [{ "label": "Width", "value": "2400 mm" }]
    }
  ],
  "notes": ["Depth and height are standard sizes until they are measured.", "Colours on screen are a guide."]
}
```

One option: name it after the piece ("The design"). `shape` "tall" (1600 x 1200 poster) for wardrobes and
cupboards, "wide" (1600 x 800) for seats, desks and long runs. Rules for every word: UK English, plain, no
dashes, no prices, deposits, timescales or guarantees, never the customer's name, street or mobile, never say
Raf paints or stains anything.

## 6. Posters (the still shown while the 3D loads)

Copy any existing still to each poster path first so the site builds, then:

```sh
[ -d node_modules ] || npm ci
npm run build && (PORT=3456 npx next start -p 3456 &) ; sleep 8
node scripts/model-poster.mjs http://localhost:3456/d/<code> /tmp/a.png 1      # 2 for option B ...
python3 scripts/poster-fit.py /tmp/a.png public/designs/<code>/a-<hash>.jpg 1600 1200
```

Look at each still (and the page on a phone-sized screen) before pushing.

## 7. Publish

```sh
git add content/designs public/designs scripts/models
git commit -m "Design <code>: <title>, <area>"      # plus the attribution lines the session asks for
git fetch -q origin && git rebase -q origin/main && git push -q origin HEAD:main
```

Check the deploy is READY (Vercel connector `list_deployments`, project prj_IkzuBXXOBx9bpqK3nZEduUPQyPAM, no team
arguments) and that `https://www.rafcarpentry.com/d/<code>` opens. The Job Kit shows "Design ready" by itself
(it asks `/api/job-kit/designs`, behind the PIN, when the app opens).
