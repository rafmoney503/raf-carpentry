# Rafal Solutions

The website for www.rafalsolutions.co.uk: systems for trade businesses, built by a carpenter.
Next.js 16, one page plus /privacy, hosted on Vercel.

## What's on the page

Hero search with rotating examples ("idea whispers"), the three running systems (CabinetOS, Job Kit, wardrobe
planner), one enquiry start to finish, the ServiceM8 connection and other integrations, how I work, trades, the
paint schedule calculator, questions, about, and the contact form. The floating "Sketch my system" button opens a
planner that builds a system sketch from the visitor's trade and problems.

## Enquiries go into ServiceM8

The contact form and the planner post to `/api/enquiry` (src/app/api/enquiry/route.ts), which makes a client,
contact and Quote job in ServiceM8 (src/lib/servicem8.ts, ported from the raf-carpentry site), emails Rafal and
sends the visitor a thank-you through ServiceM8. The visitor then sees what just happened, with the job number.

Settings in Vercel (Project > Settings > Environment Variables, Production):

| Name | Value |
| --- | --- |
| `SERVICEM8_API_KEY` | ServiceM8 API key (the same one the raf-carpentry project uses). Sensitive. |
| `RAF_EMAIL` | Optional. Where the "new enquiry" email goes. Default info@rafcarpentry.com. |

Without `SERVICEM8_API_KEY` the forms say they aren't connected yet and offer WhatsApp with the message typed in.

## Photos and fonts

Photos and CabinetOS screenshots are loaded from www.rafcarpentry.com/images (IMG in src/lib/site.ts). Fonts
(Bricolage Grotesque, Geist, Geist Mono) come from Google Fonts at build time through next/font and are served
from this site.

## Domain

rafalsolutions.co.uk is registered at GoDaddy. In GoDaddy DNS:
- remove any domain forwarding
- `A` record, name `@`, value `76.76.21.21`
- `CNAME` record, name `www`, value `cname.vercel-dns.com`
Leave the MX and TXT records alone (they are for email).
