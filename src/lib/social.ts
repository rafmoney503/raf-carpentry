import { counts, keep, kept } from './social-store';
import type { Platform, SocialOverview } from './social-types';
import { metaPart } from './meta-social';
import { threadsPart } from './threads-social';

/* The Job Kit's Social screen (src/app/job-kit/social.tsx): Instagram and Facebook (meta-social.ts, since 20 Oct 2026)
   and Threads (threads-social.ts, since 21 Oct 2026, Raf: 'Let's go with threads'), put together into one overview:
   each account's state, the profiles with their followers' history, the latest posts and the comments (on Threads:
   the replies people left) with their replies, newest first. */

type Seen = { at: number };

export async function overview(): Promise<SocialOverview> {
  const [meta, threads, seen, oldSeen] = await Promise.all([
    metaPart(),
    threadsPart(),
    kept<Seen>('seen').catch(() => null),
    kept<{ seenAt?: number }>('meta').catch(() => null), // before 21 Oct 2026 it was kept on the Facebook row
  ]);
  const parts = [meta.part, threads.part];
  const profiles = parts.flatMap((p) => p.profiles);
  // today's followers, then their history (a store that's down doesn't stop the rest)
  try {
    const rows = profiles.map((p) => ({ platform: p.platform, account: p.id, followers: p.followers, posts: p.posts ?? null }));
    if (rows.length) {
      const history = await counts(rows);
      for (const p of profiles) p.history = history.filter((h) => h.platform === p.platform && h.account === p.id).map((h) => ({ day: h.day, followers: h.followers }));
    }
  } catch {
    /* no history this time */
  }
  const order: Record<Platform, number> = { ig: 0, fb: 1, th: 2 };
  return {
    v: 2,
    meta: meta.account,
    threads: threads.account,
    profiles: profiles.sort((a, b) => order[a.platform] - order[b.platform]),
    posts: parts.flatMap((p) => p.posts).sort((a, b) => b.at - a.at),
    comments: parts
      .flatMap((p) => p.comments)
      .sort((a, b) => (b.activeAt ?? b.at) - (a.activeAt ?? a.at))
      .slice(0, 100),
    seenAt: Math.max(seen?.at ?? 0, oldSeen?.seenAt ?? 0),
    problems: parts.flatMap((p) => p.problems),
    at: Date.now(),
  };
}

/* The newest comment Raf has had in front of him, for every platform at once. */
export async function markSeen(at: number) {
  const now = await kept<Seen>('seen').catch(() => null);
  if ((now?.at ?? 0) >= at) return;
  await keep('seen', { at: Math.min(at, Date.now() + 60_000) });
}
