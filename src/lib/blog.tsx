import { readFileSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { POSTS, type PostMeta } from '@/content/blog/posts';

/* Blog posts: the words come from src/content/blog/<slug>.md, read when the page is built. The markdown is the small
   part the posts use: ## and ### headings, paragraphs, - and 1. lists, > a quote, **bold** and [links](url). Links
   to this site stay on the site; links elsewhere open in a new tab. */

const DIR = path.join(process.cwd(), 'src/content/blog');

export function getPost(slug: string): { meta: PostMeta; body: ReactNode } | null {
  const meta = POSTS.find((p) => p.slug === slug);
  if (!meta) return null;
  const md = readFileSync(path.join(DIR, `${slug}.md`), 'utf8');
  return { meta, body: render(md) };
}

function inline(text: string, key: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}b${n++}`}>{m[1]}</strong>);
    else {
      const href = m[3];
      const inside = href.startsWith('/') || href.startsWith('#');
      out.push(
        inside ? (
          <Link key={`${key}a${n++}`} href={href}>
            {m[2]}
          </Link>
        ) : (
          <a key={`${key}a${n++}`} href={href} target="_blank" rel="noopener">
            {m[2]}
          </a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment key={key}>{out}</Fragment>;
}

function render(md: string): ReactNode {
  const blocks = md.replace(/\r/g, '').trim().split(/\n{2,}/);
  return blocks.map((b, i) => {
    const k = `b${i}`;
    const lines = b.split('\n');
    if (b.startsWith('### ')) return <h3 key={k}>{inline(b.slice(4), k)}</h3>;
    if (b.startsWith('## ')) {
      const t = b.slice(3);
      return (
        <h2 key={k} id={t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}>
          {inline(t, k)}
        </h2>
      );
    }
    if (lines.every((l) => l.startsWith('- ')))
      return (
        <ul key={k}>
          {lines.map((l, j) => (
            <li key={j}>{inline(l.slice(2), `${k}l${j}`)}</li>
          ))}
        </ul>
      );
    if (lines.every((l) => /^\d+\. /.test(l)))
      return (
        <ol key={k}>
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\d+\. /, ''), `${k}l${j}`)}</li>
          ))}
        </ol>
      );
    if (lines.every((l) => l.startsWith('> ')))
      return (
        <blockquote key={k}>
          <p>{inline(lines.map((l) => l.slice(2)).join(' '), k)}</p>
        </blockquote>
      );
    return <p key={k}>{inline(lines.join(' '), k)}</p>;
  });
}
