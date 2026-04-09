# How to Manage Affiliate Links & Tools
# ========================================
# Last updated: April 2026
# File location: src/lib/affiliates.ts


## ADDING YOUR AMAZON AFFILIATE LINKS
## ------------------------------------

1. Open this file in Cursor: src/lib/affiliates.ts
2. Find the tool you want to add a link for
3. Replace the '#' with your Amazon affiliate URL

   BEFORE:
   'makita-track-saw': { name: 'Makita Track Saw', url: '#', category: 'Power Tools' },

   AFTER:
   'makita-track-saw': { name: 'Makita Track Saw', url: 'https://amzn.to/3xYzAbC', category: 'Power Tools' },

4. Save the file
5. In terminal run:
   git add . && git commit -m "Update affiliate links" && git push
6. Vercel auto-deploys in ~60 seconds. Done!


## ADDING A NEW TOOL/PRODUCT
## --------------------------

1. Open: src/lib/affiliates.ts
2. Add a new line inside the affiliateLinks object:

   'your-tool-key': { name: 'Tool Display Name', url: 'https://amzn.to/xxx', category: 'Power Tools' },

   Rules:
   - Key: lowercase, hyphens, no spaces (e.g. 'bosch-router')
   - Name: what visitors see (e.g. 'Bosch Router 1400')
   - URL: your Amazon affiliate link (or '#' as placeholder)
   - Category: 'Power Tools', 'Hand Tools', 'Measuring', or 'Software'

3. To show it on the TOOLS PAGE (rafcarpentry.com/tools):
   Open: src/app/tools/page.tsx
   Find the right category and add a new entry:

   { name: 'Bosch Router 1400', desc: 'Great for edge profiles and grooves.', link: '#', price: '£££' },

4. Save, commit, push.


## ADDING TOOLS TO A BLOG POST
## ----------------------------

1. Open your blog post file in: content/blog/your-post.md
2. Add a 'tools' section in the frontmatter (the part between --- and ---):

   ---
   title: "Your Post Title"
   date: "2026-04-10"
   excerpt: "Short description"
   category: "Projects"
   tools:
     - name: "Makita Track Saw"
       link: "https://amzn.to/xxx"
     - name: "Stanley FatMax Tape"
       link: "https://amzn.to/yyy"
     - name: "Cabinetos App"
       link: "/cabinetos"
   ---

   This will show a "Tools Used in This Post" box at the bottom of the article.

3. Save, commit, push.


## WRITING A NEW BLOG POST
## -------------------------

1. Create a new file in: content/blog/
   Name it with hyphens, e.g.: my-new-post.md

2. Start with this template:

   ---
   title: "Your Post Title Here"
   date: "2026-04-10"
   excerpt: "A short 1-2 sentence description that appears on the blog listing page."
   category: "Projects"
   image: "/images/blog/your-image.jpg"
   tools:
     - name: "Tool Name"
       link: "https://amzn.to/xxx"
   ---

   Your post content goes here. Write in plain text.

   ## Use Headings Like This

   Write paragraphs normally. Leave a blank line between paragraphs.

   - You can use bullet points
   - Like this

   **Bold text** and *italic text* work too.

3. To add an image to the post:
   - Put the image in: public/images/blog/
   - Reference it in the frontmatter 'image' field
   - Or inline: ![Alt text](/images/blog/photo.jpg)

4. Save, commit, push.


## QUICK REFERENCE: FILE LOCATIONS
## --------------------------------

Affiliate links config:    src/lib/affiliates.ts
Tools page:                src/app/tools/page.tsx
Blog posts:                content/blog/*.md
Blog images:               public/images/blog/
Project images:            public/images/projects/
Homepage:                  src/app/page.tsx
Mini-site (Instagram):     src/app/ms/page.tsx
Navbar:                    src/components/Navbar.tsx
Footer:                    src/components/Footer.tsx


## PUSHING CHANGES TO LIVE SITE
## ------------------------------

Every time you make changes:

   cd /Users/rafaljanczy/Documents/App_Builds/raf-carpentry
   git add .
   git commit -m "Describe what you changed"
   git push

Vercel auto-deploys. Wait ~60 seconds, then Cmd+Shift+R to hard refresh.


## NEED HELP?
## -----------

Start a new Claude chat and say:
"I'm working on my raf-carpentry Next.js website hosted on Vercel.
GitHub repo: https://github.com/rafmoney503/raf-carpentry
I need help with [describe what you need]."

Claude can edit files, write blog posts, add features, and give you
the exact commands to push changes.
