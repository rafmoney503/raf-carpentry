import { ReviewScreen } from '@/components/review';
import { reviewList } from '@/lib/review';

export const dynamic = 'force-dynamic';

/* The daily review: yesterday across every app, and the ideas still open. Read from Supabase each time. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const list = await reviewList(21);
  return <ReviewScreen list={list} day={typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined} />;
}
