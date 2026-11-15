/* One Facebook Page's progress, for Rafal Solutions HQ (15 Nov 2026, Raf: 'add separate section in hq for this page
   and its progress', the Cabinet OS Page). Made by pageReport() in raf-carpentry's src/lib/meta-social.ts, served to HQ by
   src/app/api/hq/facebook/route.ts. No imports: this is HQ's copy of raf-carpentry's src/lib/page-report-types.ts; change both. */

export type PageReportState =
  | 'ok'
  | 'not-set-up' // META_APP_ID / META_APP_SECRET / JOBKIT_SYNC_SECRET missing on rafcarpentry.com
  | 'not-connected' // Instagram and Facebook not connected in the Job Kit's Social screen
  | 'not-shared' // connected, but the login didn't share this Page (Connect again and tick it)
  | 'expired' // Facebook wants a new login
  | 'error';

export type PagePost = {
  id: string;
  text: string;
  at: number;
  link: string;
  thumb?: string;
  kind: 'video' | 'photo' | 'post';
  reactions: number;
  comments: number;
  shares: number;
};

export type PageComment = {
  id: string;
  post: string;
  who: string;
  text: string;
  at: number; // their newest word in the thread
  link: string;
  answered: boolean; // the Page has replied since
};

export type PageReport = {
  v: 1;
  at: number;
  state: PageReportState;
  detail?: string;
  pages?: string[]; // the Pages the login shares, when this one isn't among them
  page?: {
    id: string;
    name: string;
    link: string;
    handle?: string;
    picture?: string;
    followers: number | null;
    likes: number | null;
  };
  history: { day: string; followers: number | null }[]; // one a London day, oldest first (jobkit.social_counts)
  posts: PagePost[]; // newest first, up to 25
  comments: PageComment[]; // people's comments on those posts, newest first, up to 40
};
