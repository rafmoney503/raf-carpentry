# Rafal Solutions HQ

Every app's numbers in one place: visitors for each site, quote taps, CabinetOS sign-ups, what's worth knowing,
whether the sites are up, and a morning summary on the phone. Built 11 Nov 2026 from the "Rafal Solutions HQ" design
canvas. Private: the Job Kit PIN to get in, not indexed.

Lives on the `rafal-hq` branch of rafmoney503/raf-carpentry (its own app, like `rafal-solutions-site`), deployed to
the Vercel project **rafal-hq** by hand (`git.deploymentEnabled` is off for this branch, so no other project builds
it): `create_deployment` with gitSource github rafmoney503/raf-carpentry, ref `rafal-hq`, target production.

## Where the numbers come from

- **Visitors, sources, pages, countries, devices**: Vercel Web Analytics through the REST API
  (`/v1/query/web-analytics/visits/aggregate` and `/count`), with `VERCEL_ACCESS_TOKEN` (a token Rafal made at
  vercel.com/account/settings/tokens, scope "Rafal's projects"). Vercel's visitors reset every day, so a week's
  visitors are the sum of the days. Day buckets are UTC (London in winter, an hour off in summer).
- **Updates going live**: Vercel `/v6/deployments` (newest production one), same token.
- **Up or down**: HQ fetches each site's address (8 s).
- **Quote taps, CabinetOS accounts, SketchUp extension**: Supabase project cabinetos, function `public.hq_api`
  (`supabase/hq.sql`, migration `hq_api`), behind `HQ_DB_SECRET` (its sha256 is in `hq.config`). It also keeps when
  each "worth knowing" was first seen (`hq.insights`), the phones that get the morning summary (`hq.push`) and the
  days it was sent (`hq.sent`).

- **Messages** (12 Nov 2026): what people send with Tell us on builditin3d.com (`b3d.suggestions`, made by
  builditin3d's supabase/b3d.sql), read through `hq_api` (migration `hq_api_b3d`): 'report' brings how many are new,
  'suggestions' the latest 200 and the lesson faces of the last 90 days, 'suggestions_read' marks them read or new.
  The Messages page (with the count on the tab), a card on Today while some are new, and a line in the morning
  summary for yesterday's. Nothing is deleted from HQ.

The sites and what counts as their home page and key pages are in `src/lib/sites.ts`. The "worth knowing" rules are
`src/lib/insights.ts` (checked by `npm run check`).

## Settings (Vercel, project rafal-hq, Production)

| Name | What |
| --- | --- |
| `VERCEL_ACCESS_TOKEN` | Rafal adds it (Sensitive). Without it HQ shows a "Connect HQ to Vercel" card. |
| `HQ_SUPABASE_URL`, `HQ_SUPABASE_KEY` | The cabinetos project's address and publishable key. |
| `HQ_DB_SECRET` | The secret for `hq_api`. |
| `HQ_SESSION_SECRET` | Signs the sign-in cookie (90 days). |
| `CRON_SECRET` | Vercel sends it to `/api/cron/morning`. |
| `HQ_VAPID_PUBLIC`, `HQ_VAPID_PRIVATE` | Web Push keys for the morning summary. |
| `HQ_PIN` | Optional. Without it the PIN is checked against the Job Kit's (rafcarpentry.com `/api/pots`, action check). |

## Morning summary

Alerts → Turn on the morning summary (on an iPhone, add HQ to the Home Screen first). Vercel's cron calls
`/api/cron/morning` at 06:43 and 07:43 UTC; it sends in the run that is 07:43 in London, once a day: yesterday's
visitors per site and taps, then anything new worth knowing.

## Testing

The tests run against stand-ins for Vercel, Supabase (the real `hq_api` on a local Postgres 16), the PIN check and a
push service (scratchpad hqtest/: mocks.mjs, start.sh, test.cjs, 65 checks at 390, 320 and 1440 px).
