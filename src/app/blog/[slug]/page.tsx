import Link from 'next/link';
import Image from 'next/image';
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { notFound } from 'next/navigation';
import ToolsUsed from '@/components/ToolsUsed';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <article className="max-w-3xl mx-auto px-6 pt-24 pb-20 md:pt-32">
        <Link href="/blog" className="text-sm text-[--gold] hover:underline mb-6 inline-block">
          ← Back to Journal
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[--gold]">{post.category}</span>
          <span className="text-xs text-[--text-muted]">·</span>
          <span className="text-xs text-[--text-muted]">
            {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">{post.title}</h1>

        {post.image && (
          <div className="aspect-video rounded-2xl border border-[--border] bg-[--bg-card] mb-10 relative overflow-hidden">
            <Image src={post.image} alt={post.title} fill className="object-cover" />
          </div>
        )}

        <div
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: post.content || '' }}
        />

        {post.tools && <ToolsUsed tools={post.tools} />}
      </article>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-[--border] bg-[--bg-card] p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Enjoyed this post?</h3>
            <p className="text-sm text-[--text-muted]">Follow me on social media for more tips, builds, and behind-the-scenes content.</p>
          </div>
          <div className="flex gap-3">
            <a href="https://www.instagram.com/raf_carpentry/" target="_blank" rel="noopener" className="px-5 py-2.5 rounded-xl border border-[--border] text-sm hover:border-[--gold] hover:text-[--gold] transition-colors">Instagram</a>
            <a href="https://www.tiktok.com/@rafcarpentry" target="_blank" rel="noopener" className="px-5 py-2.5 rounded-xl border border-[--border] text-sm hover:border-[--gold] hover:text-[--gold] transition-colors">TikTok</a>
          </div>
        </div>
      </section>
    </>
  );
}
