import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CtaBand from '@/components/CtaBand';
import PostCard from '@/components/PostCard';
import { POSTS, postDate, STEP_LABEL } from '@/content/blog/posts';
import { getPost } from '@/lib/blog';
import { SITE_URL } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.summary,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: 'article', title: p.title, description: p.summary, publishedTime: p.date, url: `${SITE_URL}/blog/${p.slug}` },
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const { meta, body } = post;
  const others = POSTS.filter((p) => p.slug !== meta.slug).slice(0, 3);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta.title,
    description: meta.summary,
    datePublished: meta.date,
    author: { '@type': 'Person', name: 'Rafal Janczy' },
    publisher: { '@type': 'Organization', name: 'Rafal Solutions Ltd' },
    mainEntityOfPage: `${SITE_URL}/blog/${meta.slug}`,
  };
  return (
    <>
      <article className="article" data-c={meta.step}>
        <header className="article-head">
          <div className="wrap article-wrap">
            <Link href="/blog" className="article-back">
              <span aria-hidden="true">←</span> All posts
            </Link>
            <span className="post-step">{STEP_LABEL[meta.step]}</span>
            <h1 className="h1 article-title">{meta.title}</h1>
            <p className="lead article-lead">{meta.summary}</p>
            <p className="article-meta mono">
              Rafal Janczy · {postDate(meta.date)} · {meta.minutes} min read
            </p>
          </div>
          <span className="article-planks" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </header>
        <div className="wrap article-wrap">
          <div className="prose">{body}</div>
        </div>
      </article>
      <section className="section more-posts" aria-labelledby="more-title">
        <div className="wrap">
          <h2 className="h2" id="more-title" style={{ marginBottom: 28 }}>
            More from the workshop
          </h2>
          <div className="post-grid">
            {others.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
