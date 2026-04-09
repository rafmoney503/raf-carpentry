import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';

export default function Blog() {
  const posts = getAllPosts();

  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-10 md:pt-32">
        <div className="gold-line mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          The Workshop <span className="gold-text">Journal</span>
        </h1>
        <p className="text-lg text-[--text-muted] max-w-lg">
          Tips, tutorials, and behind-the-scenes from a carpenter who codes.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        {posts.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-[--border] bg-[--bg-card]">
            <span className="text-5xl block mb-4">📝</span>
            <p className="text-[--text-muted]">Blog posts coming soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl overflow-hidden group"
              >
                <div className="aspect-video bg-[--bg-card-hover] flex items-center justify-center relative overflow-hidden">
                  {post.image ? (
                    <div className="absolute inset-0 bg-[--bg-card-hover] flex items-center justify-center">
                      <span className="text-4xl opacity-20">📷</span>
                    </div>
                  ) : (
                    <span className="text-4xl opacity-20">📝</span>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[--gold]">{post.category}</span>
                    <span className="text-xs text-[--text-muted]">·</span>
                    <span className="text-xs text-[--text-muted]">
                      {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2 group-hover:text-[--gold] transition-colors leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-sm text-[--text-muted] leading-relaxed line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 text-sm text-[--gold] opacity-0 group-hover:opacity-100 transition-opacity">
                    Read more →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
