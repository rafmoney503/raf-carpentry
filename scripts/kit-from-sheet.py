"""Build content/project-kit.json from Raf's Google Sheet ("Raf Carpentry Amazon links").

Usage: python3 scripts/kit-from-sheet.py sheet.json [output.json]
where sheet.json is {"kit": <values of 'Project kit'!A1:AC300>, "products": <values of Products!A1:M300>}
(the raw "values" arrays the Google Sheets connector returns).

Rules:
- A row goes on the site only when its Checked box (column A) is ticked.
- It is listed under every job whose column is ticked on that row (job page address in row 2).
- A tool gets an Amazon link only when its product key (column F) is Confirmed (or On the website)
  on the Products tab and that row has a real link in "Link for the website" (column G).
- A brand ending in "?" is a guess, so it is left off.
"""
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'content' / 'project-kit.json'
JOB_COL = 8  # column I


def ticked(v):
    return v is True or str(v).strip().upper() == 'TRUE'


def main(src, out=OUT):
    out = Path(out)
    data = json.loads(Path(src).read_text())
    kit, products = data['kit'], data['products']

    links = {}
    for row in products[1:]:
        row = row + [''] * (13 - len(row))
        key, link, status = row[0].strip(), row[6].strip(), row[11].strip()
        if key and status in ('Confirmed', 'On the website') and link.startswith('http'):
            links[key] = link

    slugs = kit[1][JOB_COL:] if len(kit) > 1 else []
    jobs = {s: {'materials': [], 'tools': []} for s in slugs if s}
    shown = 0
    for row in kit[2:]:
        row = row + [''] * (JOB_COL + len(slugs) - len(row))
        if not ticked(row[0]) or not row[1].strip() or row[2] not in ('Tool', 'Material'):
            continue
        item = {'name': row[1].strip()}
        brand, model = row[3].strip(), row[4].strip()
        if brand and not brand.endswith('?'):
            item['brand'] = brand
        if model:
            item['model'] = model
        if row[2] == 'Tool' and row[5].strip() in links:
            item['link'] = links[row[5].strip()]
        group = 'tools' if row[2] == 'Tool' else 'materials'
        for i, slug in enumerate(slugs):
            if slug and ticked(row[JOB_COL + i]):
                jobs[slug][group].append(item)
        shown += 1

    jobs = {s: k for s, k in jobs.items() if k['materials'] or k['tools']}
    out.write_text(json.dumps({'updated': date.today().isoformat(), 'jobs': jobs}, indent=2, ensure_ascii=False) + '\n')
    print(f'{shown} checked rows, {len(jobs)} jobs with a list, {len(links)} confirmed Amazon links -> {out}')
    for s, k in jobs.items():
        print(f'  {s}: {len(k["materials"])} materials, {len(k["tools"])} tools, {sum(1 for t in k["tools"] if "link" in t)} links')


if __name__ == '__main__':
    main(*sys.argv[1:3])
