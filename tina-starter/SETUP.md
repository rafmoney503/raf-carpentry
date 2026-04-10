# Setup: Tina + JSON pages in a Next.js 15 + Tailwind project

This kit matches a **Next.js App Router** project (Next.js **15 or newer**) that uses **Tailwind CSS** for styling. Tina supplies the CMS; Tailwind styles the components that **display** the JSON and Markdown — Tina does not replace Tailwind.

## What you are copying

From `tina-starter/` into your Next.js project root:

| Source | Destination | Purpose |
|--------|-------------|---------|
| `tina/` | `tina/` | Tina config and page/blog schema |
| `content/pages/` | `content/pages/` | One JSON file per marketing page |
| `content/blog/` | `content/blog/` | Markdown blog posts Tina edits |
| `content/posts/` (optional) | `content/posts/` | Extra Markdown not wired to Tina by default |
| `src/lib/pages.ts` | `src/lib/pages.ts` | Small helper: `readPageJson('home.json')` |

If your project has no `src/` folder, put `pages.ts` in `lib/pages.ts` at the project root and fix the import path in your app.

## 1. Install npm packages

```bash
npm install tinacms
npm install -D @tinacms/cli
```

Example pins that often work together (check [tina.io](https://tina.io) for the latest):

```bash
npm install tinacms@^3.7.2
npm install -D @tinacms/cli@^2.2.2
```

| Package | Role |
|--------|------|
| `tinacms` | Admin UI, `defineConfig`, schema |
| `@tinacms/cli` | `tinacms dev`, `tinacms build`, GraphQL |

## 2. Tailwind CSS (if not already set up)

If you are adding Tailwind to a fresh Next 15 app, follow the official **Tailwind v4 + Next** guide. You typically have:

- A global stylesheet (e.g. `src/app/globals.css`) with `@import "tailwindcss";`
- Tailwind dependencies in `package.json`

**Tina does not need extra Tailwind plugins.** You will use Tailwind classes in your own React components when you render fields from JSON (e.g. `className="text-xl font-bold"`).

## 3. Folder layout on disk

After copying, your repo should look like:

```text
your-project/
├── tina/
│   ├── .gitignore
│   ├── config.ts
│   └── pages-collections.ts
├── content/
│   ├── pages/ ← home.json, about.json, …
│   └── blog/           ← *.md posts
├── src/
│   ├── app/            ← your routes (you create these)
│   └── lib/
│       └── pages.ts    ← readPageJson helper from this starter
├── public/
│   └── images/         ← recommended for Tina mediaRoot: "images"
└── package.json
```

## 4. `package.json` scripts

Wrap Next with Tina so the admin UI and data layer start together:

```json
{
  "scripts": {
    "dev": "tinacms dev -c \"next dev\"",
    "build": "tinacms build && next build"
  }
}
```

## 5. Environment variables

Create `.env.local` (do not commit secrets):

```env
NEXT_PUBLIC_TINA_CLIENT_ID=your_client_id
TINA_TOKEN=your_token
```

Connect the repo at [tina.io](https://tina.io). The config uses `GITHUB_BRANCH`, `VERCEL_GIT_COMMIT_REF`, or `HEAD` for the Git branch when building.

## 6. Use `readPageJson` in a Server Component

Example for the home page (`src/app/page.tsx`):

```tsx
import { readPageJson } from "@/lib/pages";

type HomeContent = {
  heroTitle: string;
  heroTitleAccent: string;
  // …add fields you actually use
};

export default function HomePage() {
  const data = readPageJson<HomeContent>("home.json");
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">
        {data.heroTitle}
        <span className="text-amber-500">{data.heroTitleAccent}</span>
      </h1>
    </main>
  );
}
```

- **Why Server Components:** `readPageJson` uses `fs` and must run on the server (not in the browser).
- **Tailwind:** apply classes on the JSX you return.

Repeat for other routes, e.g. `about.json` → `src/app/about/page.tsx`, mapping **filename ↔ route** however you like.

## 7. Blog posts

Tina edits `content/blog/*.md`. Your app still needs a route (e.g. `src/app/blog/page.tsx` and `src/app/blog/[slug]/page.tsx`) that reads Markdown — often with `gray-matter` + `remark` — unless you use Tina’s generated client after `tinacms build`.

## 8. Run locally

```bash
npm run dev
```

Admin UI is usually at **`/admin`** (see `build.outputFolder` in `tina/config.ts`).

## 9. Customize the schema

- **Blog:** `post` collection in `tina/config.ts`
- **JSON pages:** `tina/pages-collections.ts` (rename `cabinetos` collection / file to match your product page if needed)

Keep JSON **keys** in sync with your TypeScript types and React components.

## 10. Generated files

After `tinacms build`, Tina may create `tina/__generated__/`. This starter’s `tina/.gitignore` ignores `__generated__`; commit or ignore per your team’s preference.

## Troubleshooting

- **Port 9000 in use:** another `tinacms dev` is running; stop it or change the port in Tina CLI docs.
- **`isTitle` errors:** fields with `isTitle: true` usually need `required: true` in the schema.
- **Images:** uploads go under `public/images/` with this config; paths in JSON are often like `/images/...`.

For breaking changes, always check the official **Tina CMS** documentation.
