import type { Metadata } from 'next';
import PostCard from '@/components/PostCard';
import CtaBand from '@/components/CtaBand';
import { POSTS } from '@/content/blog/posts';

export const metadata: Metadata = {
  title: 'Blog: everyday problems, made into tools',
  description: 'Notes from a working London workshop: how each Rafal Solutions tool started as a problem on a real job, and what was built so it would not happen again.',
  alternates: { canonical: '/blog' },
};

export default function Blog() {
  const [first, ...rest] = POSTS;
  return (
    <>
      <section className="blog-head">
        <div className="wrap">
          <p className="kicker">Notes from the workshop</p>
          <h1 className="h1">
            Everyday problems, <span className="hl">made into tools.</span>
          </h1>
          <p className="lead" style={{ maxWidth: '52ch' }}>
            Every tool here started as a problem on a real job. These are the notes: what went wrong, what I built, and how it can make someone else&apos;s day a little easier.
          </p>
        </div>
      </section>
      <section className="blog-list" aria-label="Posts">
        <div className="wrap">
          <PostCard post={first} big headingLevel={2} />
          <div className="post-grid">
            {rest.map((p) => (
              <PostCard key={p.slug} post={p} headingLevel={2} />
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
