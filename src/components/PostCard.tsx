import Link from 'next/link';
import StepIcon from './StepIcon';
import { postDate, STEP_LABEL, type PostMeta } from '@/content/blog/posts';

/* A blog post as a card: a picture tile with the step's icon in its colour, the step, the title, one line and the
   date. */

export default function PostCard({ post, big = false, headingLevel = 3 }: { post: PostMeta; big?: boolean; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Link href={`/blog/${post.slug}`} className={`post-card${big ? ' big' : ''}`} data-c={post.step}>
      <span className="post-tile" aria-hidden="true">
        <StepIcon step={post.step} size={big ? 64 : 48} />
      </span>
      <span className="post-step">{STEP_LABEL[post.step]}</span>
      <H className="post-title">{post.title}</H>
      <p className="post-sum">{post.summary}</p>
      <span className="post-meta">
        {postDate(post.date)} · {post.minutes} min read
        <span className="post-go" aria-hidden="true">
          →
        </span>
      </span>
    </Link>
  );
}
