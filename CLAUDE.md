# Raf Carpentry — Project Context for Claude
# Updated: 2 October 2026

## Owner
Rafal Janczy — carpenter based in London, UK. Builds bespoke kitchens, wardrobes, cabinets, garden offices. Also building an app called Cabinetos and is a SketchUp expert. Active on Instagram (@rafcarpentry), TikTok (@rafcarpentry), Facebook.

## Project
- **Site**: rafcarpentry.com (currently still pointed at old systeme.io — needs domain transfer to Vercel)
- **Live preview**: https://raf-carpentry.vercel.app
- **GitHub**: https://github.com/rafmoney503/raf-carpentry
- **Stack**: Next.js 16 + Tailwind CSS v4 + TypeScript + TinaCMS
- **Hosting**: Vercel (free tier, auto-deploys from GitHub main branch)
- **Blog**: Markdown files in content/blog/ — parsed with gray-matter + remark

## Design (redesign, October 2026: "drafting paper")
- **Look**: light paper background, pencil-grey text, one blueprint-blue accent, square 2px corners, photos on a white mount with a hairline border and soft shadow.
- **Colours** (Tailwind tokens in src/app/globals.css `@theme`): paper #f1f2ef, raised #e6e7e2, mount #fbfbf9, ink #16191c, muted #4f555b, faint #5e646a, accent #2547d0 (hover #1b38ad). Use `bg-paper`, `bg-raised`, `text-ink`, `text-muted`, `text-faint`, `border-line`, `border-line-strong`, `bg-accent`, `text-accent`, `text-on-accent`. Do not use hex colours or zinc/gray classes in pages.
- **Fonts** (self-hosted in src/fonts, loaded in src/app/layout.tsx with next/font/local): Bricolage Grotesque for headings (`font-display`), Geist for body (`font-sans`), Geist Mono for small labels and measurements (`font-mono`).
- **Shared pieces**: `.btn .btn-primary .btn-ghost .btn-sm`, `.link-more`, `.kicker`, `.mount` (globals.css); `Container`, `PageHeader`, `SectionHeading`, `MountedImage` (src/components/ui.tsx); `QuoteForm` (src/components/QuoteForm.tsx, used on home and contact).
- **Homepage**: src/app/page.tsx + src/app/home.css, content from content/pages/home.json (editable in TinaCMS).
- **Rules (taste-skill)**: no em-dashes in new copy, no emoji icons, one accent colour, one "Get a quote" label for every quote button, max 20 words under the hero headline.
- **Logo**: Crisp black R on white circle (public/images/r-logo-final.png).
- **Quote form**: not connected to a mail service yet. It opens the visitor's email app with the enquiry written out to info@rafcarpentry.com. Swap handleSubmit in QuoteForm.tsx for Formspree or Resend when ready.
- **/editor**: old Supabase editor, not restyled. It needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY at build time. TinaCMS (/admin) is the editor to use.

## Pages Built (all working)
1. **/** — Homepage: split hero (birch wardrobe photo), facts strip, 'What I build' (3 photo tiles), SketchUp process with the drawing, CabinetOS band, 3 newest blog posts, quote form
2. **/portfolio** — Gallery with working category filters
3. **/cabinetos** — Product landing page: features, before/after comparison, FAQ
4. **/sketchup** — Authority page: benefits, 3D vs real build comparison slots
5. **/blog** — Blog listing from markdown files
6. **/blog/[slug]** — Individual posts with prose styling, ToolsUsed component at bottom
7. **/about** — Story, stats, differentiators, social links
8. **/contact** — Form (not yet connected to backend) + contact info
9. **/tools** — Affiliate tools page with categories and disclosure
10. **/ms** — Instagram mini-site (link-in-bio), no navbar/footer, mobile optimised

## Blog Posts Written (content/blog/)
1. sketchup-planning.md — "How I Use SketchUp to Plan Every Build" (has SketchUp screenshot image)
2. cut-list-optimisation.md — "Cut List Optimisation: Save 15% on Materials"
3. outdoor-gym-lockdown.md — "Building an Outdoor Gym During Lockdown"

## Photos Added (public/images/)
- raf-at-work.jpg — Raf measuring timber (hero section)
- projects/IMG_8984.jpg — Kitchen pantry unit (open doors)
- projects/IMG_9245.jpg — Garden office units interior
- projects/IMG_8172.jpg — MDF wardrobes with panel doors
- projects/IMG_8405.jpg — Birch ply wardrobe with LED lighting
- blog/sketchup-planning.jpg — SketchUp bathroom units screenshot
- r-logo-final.png — V1 crisp R logo (black on white)

## Key Files
- src/lib/affiliates.ts — Central affiliate links config (all Amazon links in one place)
- src/lib/blog.ts — Blog utility (reads markdown, supports tools frontmatter)
- src/components/ToolsUsed.tsx — "Tools Used in This Post" component for blog posts
- src/components/LayoutShell.tsx — Conditionally hides nav/footer on /ms page
- GUIDE.md — Plain English guide for Raf on how to manage content

## What's Done
- [x] Full 10-page Next.js site built and deployed
- [x] Dark craftsman theme with gold accents
- [x] R logo (V1 crisp) in navbar, footer, mini-site
- [x] Real photos on homepage (hero + 4 projects)
- [x] Blog system with markdown and SketchUp image
- [x] Instagram mini-site at /ms
- [x] Tools/affiliate page with categories
- [x] ToolsUsed component on blog posts
- [x] Central affiliate links config
- [x] GUIDE.md for content management
- [x] Mobile hamburger menu fixed (white lines)

## What's TODO
- [ ] Connect the quote form to a backend (Formspree or Resend); it currently opens the email app
- [ ] Point rafcarpentry.com domain to Vercel
- [ ] Add real Amazon affiliate URLs to src/lib/affiliates.ts
- [ ] Connect affiliates.ts config to the Tools page (currently Tools page has hardcoded links)
- [ ] Add more blog posts with images
- [ ] Add photos to portfolio page (currently has placeholder structure)
- [ ] Add SketchUp 3D model screenshots alongside real build photos
- [ ] SEO: meta tags, Open Graph images for social sharing
- [ ] Google Analytics + Search Console setup
- [ ] Add blog images for cut-list and outdoor-gym posts
- [ ] About page: add real photo of Raf
- [ ] Cabinetos page: add app screenshots/demo when ready
- [x] Make portfolio filter buttons functional (currently static)

## How to Push Updates
```bash
cd /Users/rafaljanczy/Documents/App_Builds/raf-carpentry
# make changes or unzip update files
git add . && git commit -m "description" && git push
# Vercel auto-deploys in ~60 seconds
# Cmd+Shift+R to hard refresh browser
```

## How to Start a New Claude Chat
Upload this CLAUDE.md file and say:
"I'm continuing work on my raf-carpentry website. Here's the project context. I want to work on [specific task]."

At the END of each chat, ask Claude to update this file with any changes made.
