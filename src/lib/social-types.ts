/* Types and small helpers for the Job Kit's Social screen, with no imports, so the browser, src/lib/social.ts,
   meta-social.ts and threads-social.ts can all use them. */

export type Platform = 'ig' | 'fb' | 'th';
export type SocialDay = { day: string; followers: number | null };
export type SocialProfile = {
  platform: Platform;
  id: string;
  name: string;
  handle?: string;
  link: string;
  picture?: string;
  followers: number | null;
  following?: number | null;
  posts?: number | null;
  history: SocialDay[];
};
export type SocialReply = { id: string; who: string; text: string; at: number; mine: boolean };
/* Whose a post or comment is, when Raf runs more than one account on a platform (15 Nov 2026: the Cabinet OS Page
   beside Rafal Carpentry Services): owner = the profile's id, ownerName = its name or @handle, page = the Facebook
   Page whose token reads and replies to it. Missing on overviews from before. */
type Owned = { owner?: string; ownerName?: string; page?: string };
export type SocialComment = Owned & {
  id: string;
  platform: Platform;
  post: string; // the post's id
  who: string;
  text: string;
  at: number;
  activeAt?: number; // their newest word in this thread (a follow-up after Raf's reply), when later than `at`
  likes: number;
  link: string; // where Open goes
  replies: SocialReply[];
  answered: boolean; // Raf has replied, and they haven't written again since
};
export type SocialPost = Owned & {
  id: string;
  platform: Platform;
  text: string;
  at: number;
  link: string;
  thumb?: string;
  kind: 'reel' | 'video' | 'photo' | 'carousel' | 'post' | 'thread';
  likes: number | null;
  comments: number;
};
export type SocialProblem = { platform: Platform; error: string; detail?: string; account?: string };
/* One account's state: set up (the settings are in Vercel), connected, and what went wrong this time. */
export type SocialAccount = {
  setUp: boolean;
  missing: string[];
  connected: boolean;
  who?: string; // who connected (Facebook) or @username (Threads)
  connectedAt?: number;
  notGranted?: string[];
  error?: string; // the whole account didn't load (e.g. meta-expired): the device keeps its last numbers
  detail?: string;
};
/* pages: every Page the login shared (shown: on the Social screen beside the picked one); page: the picked one,
   Raf Carpentry's, whose Instagram is the main one. */
export type MetaAccount = SocialAccount & { pages?: { id: string; name: string; ig?: string; shown?: boolean }[]; page?: { id: string; name: string } };
export type SocialPart = { profiles: SocialProfile[]; posts: SocialPost[]; comments: SocialComment[]; problems: SocialProblem[] };
export type SocialOverview = {
  v: 2;
  meta: MetaAccount;
  threads: SocialAccount;
  profiles: SocialProfile[];
  posts: SocialPost[];
  comments: SocialComment[];
  seenAt: number;
  problems: SocialProblem[];
  at: number;
};

/* Whether Raf has answered: a reply of his after their newest word in the thread. */
export function answeredOf(replies: SocialReply[], at: number) {
  const mine = Math.max(0, ...replies.filter((r) => r.mine).map((r) => r.at));
  const theirs = Math.max(at, ...replies.filter((r) => !r.mine).map((r) => r.at));
  return { answered: mine > 0 && mine >= theirs, activeAt: theirs > at ? theirs : undefined };
}

export const ms = (t?: string) => {
  const n = t ? Date.parse(t.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')) : NaN;
  return Number.isFinite(n) ? n : 0;
};
export const clip = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n);
