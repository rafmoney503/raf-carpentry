"""Put Raf's confirmed product links on the Tools page and the blog "Tools used" lists.

Usage: python3 scripts/links-from-sheet.py products.json
where products.json is the raw "values" of Products!A1:M300 from the Google Sheet
"Raf Carpentry Amazon links" (ID 1iBZ48RoMbq_KiumV-VfNlcM3fH8ugde8Kwia6DIuLZU).

Matching is by name: column B "Name on the site" must equal the tool's name on the Tools
page or in a post's `tools:` list. A product only gets its link when its Status (column L)
is Confirmed or On the website and "Link for the website" (column G) is a real link;
anything else is shown without a link. New tools are not added here: they need a
description, so add them to content/pages/tools.json by hand (or in TinaCMS).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVE = ('Confirmed', 'On the website')


def load(src):
    rows = json.loads(Path(src).read_text())
    products = {}
    for row in rows[1:]:
        row = row + [''] * (13 - len(row))
        name, link, price, status = row[1].strip(), row[6].strip(), row[9].strip(), row[11].strip()
        if not name:
            continue
        ok = status in LIVE and (link.startswith('http') or link.startswith('/'))
        products[name] = {'key': row[0].strip(), 'category': row[2].strip(), 'link': link if ok else '', 'price': price}
    return products


def affiliates_file(products):
    groups = {}
    for name, pr in products.items():
        if pr['key']:
            groups.setdefault(pr['category'] or 'Other', []).append((pr['key'], name, pr['link'] or '#'))
    out = ["// Raf's products and their links, mirrored from the Products tab of his Google Sheet",
           "// \"Raf Carpentry Amazon links\" by scripts/links-from-sheet.py (only Confirmed rows get a link; '#' means not yet).",
           "",
           "export const affiliateLinks: Record<string, { name: string; url: string; category: string }> = {"]
    for cat, items in groups.items():
        out.append(f'  // {cat}')
        for key, name, url in items:
            out.append(f'  {json.dumps(key)}: {{ name: {json.dumps(name, ensure_ascii=False)}, url: {json.dumps(url)}, category: {json.dumps(cat)} }},')
        out.append('')
    out[-1] = '};'
    out += ['', '// Helper: get a link by key', 'export function getAffiliateUrl(key: string): string {',
            "  return affiliateLinks[key]?.url || '#';", '}', '',
            '// Amazon links (full or short) are paid links: they get rel="sponsored" and the Associate sentence.',
            'export function isAmazonLink(href?: string): boolean {',
            r"  return Boolean(href && /(^|\/\/|\.)(amazon\.|amzn\.|link\.amazon)/.test(href));", '}', '']
    (ROOT / 'src/lib/affiliates.ts').write_text('\n'.join(out))


def tools_page(products):
    p = ROOT / 'content/pages/tools.json'
    d = json.loads(p.read_text())
    changed = []
    for cat in d['categories']:
        for t in cat['tools']:
            pr = products.get(t['name'])
            if not pr:
                continue
            url = pr['link'] or '#'
            if t.get('url') != url:
                changed.append(f"tools page: {t['name']} -> {url}")
                t['url'] = url
            if pr['price'] and t.get('price') != pr['price']:
                t['price'] = pr['price']
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    return changed


def blog_posts(products):
    changed = []
    for p in sorted((ROOT / 'content/blog').glob('*.md')):
        text = p.read_text()
        head, sep, body = text.partition('\n---\n')
        def fix(m):
            name = m.group(2).strip().strip('"\'')
            pr = products.get(name)
            if not pr:
                return m.group(0)
            link = pr['link'] or '#'
            changed.append(f'{p.name}: {name} -> {link}')
            return f"{m.group(1)}{m.group(2)}\n{m.group(3)}link: '{link}'"
        new_head = re.sub(r"(\n\s*- name: )(.+)\n(\s*)link: .*", fix, head)
        if new_head != head:
            p.write_text(new_head + sep + body)
    return changed


if __name__ == '__main__':
    prods = load(sys.argv[1])
    for line in tools_page(prods) + blog_posts(prods):
        print(line)
    affiliates_file(prods)
    missing = [n for n, pr in prods.items() if pr['link'] and pr['key'] not in ('cabinetos',)
               and n not in {t['name'] for c in json.loads((ROOT / 'content/pages/tools.json').read_text())['categories'] for t in c['tools']}]
    if missing:
        print('Confirmed but not on the Tools page yet (add with a description):', ', '.join(missing))
