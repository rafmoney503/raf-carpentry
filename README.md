# Rafal Solutions

The website for www.rafalsolutions.co.uk: software for people who build things. One company, five steps.
Next.js 16, hosted on Vercel. Daylight look: warm paper, ink type, a colour for each step (globals.css tokens
--learn, --design, --make, --fit, --run) and the yellow ball.

## What's on the site

- Home: the 3D steps in the five colours, the five steps as a staircase of cards with the ball hopping between them
  (Learn: Build It in 3D, Design: CabinetOS for SketchUp, Make: CabinetOS, Fit: Workshop Tools, Run: built for you;
  src/lib/steps.ts), each tool handing the job to the next, numbers, one enquiry start to finish, the systems running
  today, the latest blog posts and the Start a project band.
- Built for you (step 5): /systems, /servicem8, /trades, /paint-schedule, /how-it-works.
- Blog: /blog and /blog/[slug]. Each post is a markdown file in src/content/blog/ plus a line in
  src/content/blog/posts.ts (title, summary, date, step colour). Add both to publish a post.
- Start a project: seven quick questions (src/components/start/StartProject.tsx), on /start and in the sheet that the
  floating button and every "Start a project" button open (StartSheet.tsx).
- About, contact, privacy.

## Enquiries go into ServiceM8

The contact form and Start a project post to `/api/enquiry` (src/app/api/enquiry/route.ts), which makes a client,
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
