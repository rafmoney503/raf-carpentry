import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';
import { Container, MountedImage, PageHeader } from '@/components/ui';

function imageExists(src?: string) {
  if (!src || !src.startsWith('/')) return false;
  return fs.existsSync(path.join(process.cwd(), 'public', src));
}

function formatDate(value: unknown) {
  const d = new Date(value instanceof Date ? value : String(value));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
}

export default function Blog() {
  const posts = getAllPosts();

  return (
    <>
      <PageHeader title="The Workshop" accent="Journal" lede="Tips, tutorials and behind-the-scenes from a carpenter who codes." />
      <Container className="pb-24 md:pb-32">
        {posts.length === 0 ? (
          <p className="border-t border-line pt-8 text-muted">The first posts are on their way.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                {imageExists(post.image) ? (
                  <MountedImage src={post.image as string} alt="" aspect="aspect-[16/10]" sizes="(max-width: 768px) 100vw, 400px" className="group-hover:border-accent" />
                ) : (
                  <div className="mount group-hover:border-accent">
                    <div className="flex aspect-[16/10] items-end bg-raised p-5">
                      <span className="font-mono text-[13px] text-faint">{post.category}</span>
                    </div>
                  </div>
                )}
                <p className="mt-5 font-mono text-[13px] text-faint">
                  {formatDate(post.date)}
                  <span className="text-line-strong"> / </span>
                  {post.category}
                </p>
                <h2 className="mt-2 text-[24px] font-[620] leading-tight transition-colors group-hover:text-accent">{post.title}</h2>
                <p className="mt-2 line-clamp-3 text-[16px] leading-relaxed text-muted">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
