# Checking Cworkshop's prices

The Job Kit's Cworkshop screen and the Quotes' finished-board option read everything from
`content/cworkshop.json`: the decors with their sheet prices, and Cworkshop's service prices. This is how
Claude checks it, once a week (the scheduled task "Cworkshop prices") or when Raf asks ("check Cworkshop",
"add <decor> to Cworkshop"). Change that one file and nothing else.

## What's in the file

- `boards`: one entry per decor. `exVat` is the price before VAT that Cworkshop's own pages showed for the
  thickness in `thick` (18, or 18.5 for Feelwood and some woodgrains) on the day in `checked`.
  `normalExVat` and `offerEnds` only while a board is on offer.
- `services`: cutting, edging (1 mm and 2 mm), hinge holes, Fast Flow and delivery. `published: true` means
  the price is on Cworkshop's website; `false` means it isn't (they price it live in their cutting list app),
  so the price is a guess. Raf can type his own on the screen; his own always wins.
- `checked`, `checkedBy`: the last check.
- `changes`: a short line per check, oldest first.

## The weekly check

1. `git fetch origin main && git checkout main && git pull --ff-only`.
2. Read prices. Cworkshop's pages can only be fetched from a link a search gave, so search first
   (WebSearch with `allowed_domains: ["cworkshop.co.uk"]`), then WebFetch a result:
   - The listing pages under `cworkshop.co.uk/our-services/` (melamine boards cut to size, MFC cut to size,
     furniture boards cut to size, boards cut to size) each show about 30 boards with their 18 mm price
     (18.5 mm for Feelwood). Read those first.
   - For a board not on them, search its code and name ("Cworkshop H3171 ST12 Oiled Kendal Oak") and fetch
     its own page. Take the price for the board's thickness only. A board page without its script shows the
     8 mm price first: never take that one. If the page shows "Total" and "With VAT", `exVat` is the Total.
3. For each board you read: set `exVat`, `checked` (today), and its offer fields (add them while it says
   Offer, remove them once the offer has ended). A board you couldn't read keeps its price and old `checked`.
   A board marked discontinued or gone: take it out, unless it is `W1000 ST9` (the usual inside), and say so
   in `changes`.
4. Services: on any board's own page, the cutting list total minus the sheet total is the cutting price
   (Greige Castello Oak: £139.81 less £92.51 = £47.30). Look at the edgebanding, delivery and CNC pages
   (`/services/panel-edgebanding/`, `/services/delivery/`, `/services/cnc-cutting/`) for any price. Only
   change a service's `price` to a figure the page shows, then set `published: true` and `checked`.
5. Set the top `checked` to today and add one line to `changes`: what changed, with old and new prices
   ("Sage Green £87.07 to £89.50"), or "No price changes" with how many were read. No dashes.
6. Run `node scripts/quotes/check.mjs`. It must pass (it checks every board's link, family, thickness, date and
   price range, and the services).
7. Commit "Cworkshop prices checked <day month>", fetch and rebase onto `origin/main`, push to `main`, and
   check the production deploy is READY with the Vercel connector (`list_deployments`, project
   `prj_IkzuBXXOBx9bpqK3nZEduUPQyPAM`, no team argument).
8. End with one short line for Raf: what changed, or that nothing did. Say plainly if a price moved by more
   than 10%, a board went, or Cworkshop's pages couldn't be read.

## Adding a decor (when Raf asks)

Find it on Cworkshop (search as above), read its 18 mm (or 18.5 mm) price and its link, and add an entry:
`code` ("U708 ST9"), `name`, `brand` (Egger or Kronospan), `family` (one of white, plain, colour, stone,
light oak, warm oak, grey oak, dark oak, walnut), `describe` (a few plain words on how it looks, from its
name and Cworkshop's words; don't make up details), `exVat`, `thick`, `url` (its page, ending
`-chipboard-2800-x-2070mm/` or `/18mm/` / `/18.5mm/`), `hex` (a swatch colour for the screen, close to how it
looks) and `checked`. Note it in `changes`, then steps 6 and 7.
