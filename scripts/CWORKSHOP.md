# Checking Cworkshop's prices

The Job Kit's Cworkshop screen and the Quotes' finished-board option read everything from
`content/cworkshop.json`: the decors with their sheet prices, and Cworkshop's service prices. This is how
Claude checks it, once a week (the scheduled task "Cworkshop prices") or when Raf asks ("check Cworkshop",
"add <decor> to Cworkshop"). Change that one file and nothing else.

## What's in the file

- `boards`: one entry per decor, Egger and Kronospan chipboard (a few hundred). `exVat` is the price before
  VAT that Cworkshop's own pages showed for the thickness in `thick` (18; 18.5 for Feelwood and some
  woodgrains; 19 for Egger's PerfectSense TM boards, which don't come in 18) on the day in `checked`.
  `normalExVat` and `offerEnds` only while a board is on offer.
- `discount`: Raf's account discount (10% off the whole order, his own figure of 6 Nov 2026). A quote takes it
  off the boards, cutting, edging and drilling in one line. Never change it unless Raf says.
- `services`: cutting, edging (1 mm, and 2 mm used only when a quote ticks it), hinge holes, narrow panel
  edging, tape to take away (sold in 5 m at least), Fast Flow and delivery, all at Cworkshop's own price,
  before his discount. `source` says where each came from: `website` (their pages), `basket` (a basket Raf
  sent), `raf` (his own figure: delivery, about £60, more for a heavy order) or `guess`. Raf can type his own
  on the screen; his own always wins.
- `checked`, `checkedBy`: the last check.
- `changes`: a short line per check, oldest first.

## The weekly check

1. `git fetch origin main && git checkout main && git pull --ff-only`.
2. Pick this week's boards. There are too many to read in one go (a session has about 200 searches, and
   the site refuses bursts), so each week read the **80 boards with the oldest `checked`** (ties: the order
   in the file), which checks every board about once a month, and then **add up to 40 decors** from
   Cworkshop's Egger and Kronospan chipboard listings (`/sheet-materials/egger/`, `/sheet-materials/kronospan/`,
   from a search) that aren't in the file yet. Leave out boards marked out of stock when adding.
3. Read prices. Cworkshop's pages can only be fetched from a link a search gave, so search first
   (WebSearch with `allowed_domains: ["cworkshop.co.uk"]`), then WebFetch a result. Fetch **one page at a
   time** (helpers too: at most three fetching at once); several at once makes the site answer every fetch
   with an error for a few minutes. A search often returns several boards' pages: use those links rather
   than searching each board.
   - The listing pages under `cworkshop.co.uk/our-services/` (melamine boards cut to size, MFC cut to size,
     furniture boards cut to size, boards cut to size) each show about 30 boards with their 18 mm price
     (18.5 mm for Feelwood). Read those first.
   - For a board not on them, search its code and name ("Cworkshop 18mm Egger H3171 ST12 Oiled Kendal Oak")
     and fetch its own page, preferably the link ending `/18mm/` (`/18.5mm/`, `/19mm/`). Take the full-sheet
     price for the board's thickness only, never the cut-to-size figure (the sheet plus about £47.30). A page
     without the thickness in its link shows the 8 mm price first: never take that one. If the page shows
     "Total" and "With VAT", `exVat` is the Total.
4. For each board you read: set `exVat`, `checked` (today), and its offer fields (add them while it says
   Offer, remove them once the offer has ended). A board you couldn't read keeps its price and old `checked`.
   A board marked discontinued or gone: take it out, unless it is `W1000 ST9` (the usual inside), and say so
   in `changes`.
5. Services: on any board's own page, the cutting list total minus the sheet total is the cutting price
   (Greige Castello Oak: £139.81 less £92.51 = £47.30). Look at the edgebanding, delivery and CNC pages
   (`/services/panel-edgebanding/`, `/services/delivery/`, `/services/cnc-cutting/`) for any price. Only
   change a service's `price` to a figure the page shows (their price, before Raf's discount), then set
   `published: true`, `source: "website"` and `checked`. Leave `basket` and `raf` prices alone unless the
   website shows a different figure for the same thing, and then say so in `changes` rather than change it.
6. Set the top `checked` to today and add one line to `changes`: what changed, with old and new prices
   ("Sage Green £87.07 to £89.50"), how many were read and added, or "No price changes" with how many were
   read. No dashes.
7. Run `node scripts/quotes/check.mjs`. It must pass (it checks every board's link, family, thickness, date and
   price range, and the services).
8. Commit "Cworkshop prices checked <day month>", fetch and rebase onto `origin/main`, push to `main`, and
   check the production deploy is READY with the Vercel connector (`list_deployments`, project
   `prj_IkzuBXXOBx9bpqK3nZEduUPQyPAM`, no team argument).
9. End with one short line for Raf: what changed, or that nothing did. Say plainly if a price moved by more
   than 10%, a board went, or Cworkshop's pages couldn't be read.

## Adding a decor (when Raf asks)

Find it on Cworkshop (search as above), read its 18 mm (or 18.5 mm) price and its link, and add an entry:
`code` ("U708 ST9"), `name`, `brand` (Egger or Kronospan), `family` (one of white, plain, colour, stone,
textile, metal, light oak, warm oak, grey oak, dark oak, walnut: the wood families go by tone, so an ash or an
elm goes with the oaks of its colour), `describe` (a few plain words on how it looks, from its
name and Cworkshop's words; don't make up details), `exVat`, `thick`, `url` (its page, ending
`-chipboard-2800-x-2070mm/` or `/18mm/`; an 18.5 or 19 mm board links to its `/18.5mm/` or `/19mm/` page), `hex` (a swatch colour for the screen, close to how it
looks) and `checked`. Note it in `changes`, then steps 7 and 8.
