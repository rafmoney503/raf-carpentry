import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postsDir = path.join(process.cwd(), 'content/blog');

export interface PostTool {
  name: string;
  link?: string;
  url?: string;
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  image?: string;
  content?: string;
  tools?: PostTool[];
}

export function getAllPosts(): Post[] {
  if (!fs.existsSync(postsDir)) return [];
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  const posts = files.map(file => {
    const slug = file.replace('.md', '');
    const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const { data } = matter(raw);
    return {
      slug,
      title: data.title || slug,
      date: data.date || '',
      excerpt: data.excerpt || '',
      category: data.category || 'General',
      image: data.image || undefined,
    };
  });
  const time = (v: unknown) => new Date(v instanceof Date ? v : String(v)).getTime() || 0;
  return posts.sort((a, b) => time(b.date) - time(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const file = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  const { data, content } = matter(raw);
  const processed = await remark().use(html).process(content);
  return {
    slug,
    title: data.title || slug,
    date: data.date || '',
    excerpt: data.excerpt || '',
    category: data.category || 'General',
    image: data.image || undefined,
    // Photos in the post body load as you scroll.
    content: processed.toString().replace(/<img /g, '<img loading="lazy" decoding="async" '),
    tools: data.tools || undefined,
  };
}
