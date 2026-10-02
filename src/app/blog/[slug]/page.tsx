import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { notFound } from 'next/navigation';
import ToolsUsed from '@/components/ToolsUsed';
import { MountedImage } from '@/components/ui';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function imageExists(src?: string) {
  if (!src || !src.startsWith('/')) return false;
  return fs.existsSync(path.join(process.cwd(), 'public', src));
}

function formatDate(value: unknown) {
  const d = new Date(value instanceof Date ? value : String(value));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <article className="mx-auto max-w-3xl px-5 pb-16 pt-12 md:px-6 md:pt-20">
        <Link href="/blog" className="link-more text-[15px]">
          <span aria-hidden="true">←</span> Back to the journal
        </Link>

        <p className="mt-8 font-mono text-[13px] text-faint">
          {formatDate(post.date)}
          <span className="text-line-strong"> / </span>
          {post.category}
        </p>
        <h1 className="mt-3 font-display text-[36px] font-[680] leading-[1.06] tracking-[-0.03em] md:text-[48px]">{post.title}</h1>

        {imageExists(post.image) && (
          <MountedImage src={post.image as string} alt="" aspect="aspect-video" priority sizes="(max-width: 768px) 100vw, 720px" className="mb-10 mt-10" />
        )}

        <div className={`prose-custom text-[17px] ${imageExists(post.image) ? '' : 'mt-10'}`} dangerouslySetInnerHTML={{ __html: post.content || '' }} />

        {post.tools && <ToolsUsed tools={post.tools} />}
      </article>

      <section className="mx-auto max-w-3xl px-5 pb-24 md:px-6">
        <div className="flex flex-col gap-6 border-t border-line pt-10 md:flex-row md:items-center">
          <div className="flex-1">
            <h3 className="text-[23px] font-[620]">Enjoyed this post?</h3>
            <p className="mt-1 text-muted">Follow along for more builds, tips and behind-the-scenes.</p>
          </div>
          <div className="flex gap-3">
            <a href="https://www.instagram.com/rafcarpentry/" target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Instagram</a>
            <a href="https://www.tiktok.com/@rafcarpentry" target="_blank" rel="noopener" className="btn btn-ghost btn-sm">TikTok</a>
          </div>
        </div>
      </section>
    </>
  );
}
