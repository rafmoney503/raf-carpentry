/* npm run check: the Facebook section's sums (src/lib/fbprogress.ts) on made-up Pages. */
import { daysAgo, fbMorningLine, fbProgress, signed } from '../src/lib/fbprogress';
import type { PageReport } from '../src/lib/fbpage-types';
import { londonMidnight } from '../src/lib/time';

let pass = 0;
let fail = 0;
function ok(c: boolean, m: string) {
  if (c) pass++;
  else {
    fail++;
    console.log('FAIL', m);
  }
}

const today = '2026-11-25';
const at = (day: string, h = 12) => londonMidnight(day).getTime() + h * 3600_000;
const post = (id: string, day: string, reactions = 0, comments = 0, shares = 0) => ({ id, text: `Post ${id}`, at: at(day), link: `https://facebook.com/${id}`, kind: 'photo' as const, reactions, comments, shares });
const base = (more: Partial<PageReport> = {}): PageReport => ({
  v: 1,
  at: at(today),
  state: 'ok',
  page: { id: '615', name: 'Cabinet OS', link: 'https://facebook.com/615', followers: 23, likes: 20 },
  history: [],
  posts: [],
  comments: [],
  ...more,
});

// day 1: no history yet, the first post today
let p = fbProgress(base({ history: [{ day: today, followers: 3 }], page: { id: '615', name: 'Cabinet OS', link: 'x', followers: 3, likes: 3 }, posts: [post('a', today, 2)] }), today);
ok(p.followers === 3 && p.dayN === 1 && p.started === today, 'day 1');
ok(p.week === null && p.yesterday === null, 'no change on day 1');
ok(p.next?.at === 10 && p.next.prev === 0 && p.next.left === 7 && Math.abs(p.next.share - 0.3) < 1e-9 && p.next.inDays === null, 'next round number on day 1, no pace yet');
ok(p.days.length === 1 && p.days[0].followers === 3 && p.days[0].gained === null, 'one day in the chart');
ok(p.postsWeek === 1 && p.lastPost?.days === 0 && p.best?.id === 'a', 'posted today');
ok(daysAgo(0) === 'today' && daysAgo(1) === 'yesterday' && daysAgo(4) === '4 days ago', 'days ago words');
ok(signed(3) === '+3' && signed(-2) === '−2' && signed(0) === 'no change', 'signed');

// ten days in: a week's change, yesterday's, the pace, a gap in the counts
const hist = [
  { day: '2026-11-15', followers: 2 },
  { day: '2026-11-16', followers: 4 },
  { day: '2026-11-18', followers: 9 },
  { day: '2026-11-19', followers: 11 },
  { day: '2026-11-21', followers: null },
  { day: '2026-11-24', followers: 20 },
  { day: today, followers: 21 },
];
const posts = [post('p1', '2026-11-15', 3, 1), post('p2', '2026-11-17', 10, 2, 1), post('p3', '2026-11-20', 4), post('p4', '2026-11-22', 1)];
p = fbProgress(base({ history: hist, posts }), today);
ok(p.followers === 23, 'followers from the Page, not the stored day');
ok(p.since === '2026-11-15' && p.started === '2026-11-15' && p.dayN === 11, 'day 11');
ok(p.yesterday === 3, 'since yesterday: 23 − 20');
ok(p.week?.full === true && p.week.from === '2026-11-18' && p.week.change === 14, 'on a week ago: 18 Nov’s 9');
ok(p.next?.at === 25 && p.next.prev === 10 && p.next.left === 2, 'next: 25');
ok(p.next?.inDays === 1, 'pace over 10 days (2 → 23): about 2 a day, so 1 day');
ok(p.days.length === 11 && p.days[0].day === '2026-11-15' && p.days.at(-1)?.followers === 23, '11 days in the chart, today’s from the Page');
ok(p.days.find((d) => d.day === '2026-11-17')?.followers === null && p.days.find((d) => d.day === '2026-11-18')?.gained === 5, 'a day not counted, and the next day’s gain from the last count');
ok(p.days.find((d) => d.day === '2026-11-21')?.followers === null, 'a stored day with no number');
ok(p.postsWeek === 2 && p.postsBefore === 2, '2 posts in the last 7 days (19 to 25 Nov), 2 the week before');
ok(p.lastPost?.days === 3, 'last post 3 days ago');
ok(p.best?.id === 'p2', 'best post: most reactions, comments and shares');
ok(p.totals.reactions === 18 && p.totals.comments === 3 && p.totals.shares === 1 && p.perPost?.reactions === 4.5, 'totals and a post’s average');

// a week not counted yet: the change is from the first count
p = fbProgress(base({ history: [{ day: '2026-11-22', followers: 15 }, { day: '2026-11-24', followers: 20 }] }), today);
ok(p.week?.full === false && p.week.from === '2026-11-22' && p.week.change === 8, 'since the first count when there’s no week');
ok(p.days.length === 4 && p.days[0].day === '2026-11-22', 'the chart starts on the first count');

// over 30 days: the chart keeps the last 30
const long = Array.from({ length: 45 }, (_, i) => ({ day: new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10), followers: 100 + i }));
p = fbProgress(base({ history: long, page: { id: '615', name: 'Cabinet OS', link: 'x', followers: 144, likes: 1 } }), today);
ok(p.days.length === 30 && p.days[0].day === '2026-10-27' && p.days[0].gained === 1, '30 days, the first with its gain');
ok(p.next?.at === 250 && p.next.prev === 100, 'between 100 and 250');
ok(p.next?.inDays === 106, 'about 1 a day: 106 days to 250');

// past the last round number, and losing followers
p = fbProgress(base({ page: { id: '615', name: 'Cabinet OS', link: 'x', followers: 120000, likes: 1 } }), today);
ok(p.next?.at === 200000 && p.next.prev === 100000, 'past 100,000');
p = fbProgress(base({ history: [{ day: '2026-11-18', followers: 30 }], page: { id: '615', name: 'Cabinet OS', link: 'x', followers: 28, likes: 1 } }), today);
ok(p.week?.change === -2 && p.next?.inDays === null, 'losing followers: no pace');

// no followers number at all
p = fbProgress(base({ page: { id: '615', name: 'Cabinet OS', link: 'x', followers: null, likes: null } }), today);
ok(p.followers === null && p.next === null && p.week === null, 'no number from Facebook');

// comments to answer: newest first, answered ones left out
p = fbProgress(base({ comments: [
  { id: 'c1', post: 'p1', who: 'Mark', text: 'Kitchens?', at: at('2026-11-20'), link: 'x', answered: false },
  { id: 'c2', post: 'p1', who: 'Sue', text: 'Price?', at: at('2026-11-24'), link: 'x', answered: false },
  { id: 'c3', post: 'p2', who: 'Tom', text: 'Great', at: at('2026-11-23'), link: 'x', answered: true },
] }), today);
ok(p.toAnswer.length === 2 && p.toAnswer[0].who === 'Sue', 'comments to answer, newest first');

// the morning line
ok(fbMorningLine(base({ history: [{ day: '2026-11-24', followers: 20 }] }), today) === 'Cabinet OS on Facebook: 23 followers (+3 yesterday)', 'morning line');
ok(fbMorningLine(base({ comments: [{ id: 'c', post: 'p', who: 'A', text: 'x', at: 1, link: 'x', answered: false }] }), today) === 'Cabinet OS on Facebook: 23 followers · 1 comment to answer', 'morning line with a comment');
ok(fbMorningLine(base({ state: 'not-shared', page: undefined }), today) === null && fbMorningLine(null, today) === null, 'no line when it can’t be read');
ok(fbMorningLine(base({ page: { id: '6', name: 'Cabinet OS', link: 'x', followers: 1, likes: 1 } }), today) === 'Cabinet OS on Facebook: 1 follower', 'one follower');

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
