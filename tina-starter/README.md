# Tina CMS starter (JSON pages + Markdown blog)

Portable kit derived from the **raf-carpentry** Tina setup: copy these folders into any **Next.js 15+** app with **Tailwind**, then follow **`SETUP.md`**.

- **`SETUP.md`** — npm installs, Tailwind note, env vars, scripts, where to put `src/lib/pages.ts`, and a minimal Server Component example.
- **`tina/`** — `config.ts` + `pages-collections.ts` (blog + all JSON page collections).
- **`content/pages/`** — placeholder JSON (same **schema** as the reference project; no business-specific copy).
- **`content/blog/`** — three example posts (tools frontmatter, tags, lorem body).
- **`content/posts/`** — optional extra Markdown (not part of the Tina schema here).
- **`src/lib/pages.ts`** — `readPageJson<T>(filename)` reading `content/pages`.

This folder is **not** a runnable Next app by itself: you still add `src/app` routes and Tailwind styles in your real project.

## Contents

```text
tina-starter/
├── README.md
├── SETUP.md
├── src/
│   └── lib/
│       └── pages.ts
├── tina/
│   ├── .gitignore
│   ├── config.ts
│   └── pages-collections.ts
└── content/
    ├── pages/
    │   ├── home.json
    │   ├── about.json
    │   ├── contact.json
    │   ├── portfolio.json
    │   ├── cabinetos.json   ← rename / reshape for your product page
    │   ├── sketchup.json
    │   ├── tools.json
    │   └── ms.json
    ├── blog/
    │   ├── example-post.md
    │   ├── example-post-efficiency.md
    │   └── example-post-case-study.md
    └── posts/
        └── hello-world.md
```

## npm packages

```bash
npm install tinacms
npm install -D @tinacms/cli
```

See **`SETUP.md`** for version pins and integration steps.
