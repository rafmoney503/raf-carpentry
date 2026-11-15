import Link from 'next/link';
import { FbFollowers } from '@/components/fbpage';
import { FB_STYLE, FbSetup, PagePic } from '@/components/fbparts';
import { Icon, Pill } from '@/components/ui';
import { getFbPage } from '@/lib/fbpage';
import { daysAgo, fbProgress, signed } from '@/lib/fbprogress';
import type { PagePost } from '@/lib/fbpage-types';
import { num, plural } from '@/lib/format';
import { clock, longDay, londonDay, shortDay, when } from '@/lib/time';

export const dynamic = 'force-dynamic';

/* The Cabinet OS Facebook Page and how it's going (15 Nov 2026, Raf: 'add separate section in hq for this page and its
   progress'): followers and their days, the next round number, the posting rhythm, the best post, the comments still
   to answer and every post with its reactions, comments and shares. Read through rafcarpentry.com (src/lib/fbpage.ts). */
export default async function FacebookPage({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  const { fresh } = await searchParams;
  const res = await getFbPage(fresh === '1');
  const today = londonDay();

  const top = (
    <div className="top" style={{ justifyContent: 'space-between' }}>
      <Link href="/" className="back">
        <Icon name="back" size={20} />
        HQ
      </Link>
      <span style={{ display: 'flex', gap: 8 }}>
        <a className="round" href="/facebook?fresh=1" aria-label="Get the numbers again">
          <Icon name="refresh" size={18} />
        </a>
        {res.ok && res.report.page ? (
          <a className="round" href={res.report.page.link} target="_blank" rel="noreferrer" aria-label={`Open ${res.report.page.name} on Facebook`}>
            <Icon name="open" size={18} />
          </a>
        ) : null}
      </span>
    </div>
  );

  if (!res.ok || res.report.state !== 'ok' || !res.report.page) {
    return (
      <div className="appc stack" style={{ ...FB_STYLE, gap: 14 }}>
        {top}
        <div className="apphead">
          <span className="tile" aria-hidden="true">
            C
          </span>
          <div>
            <h1>Cabinet OS on Facebook</h1>
            <small>Facebook Page</small>
          </div>
        </div>
        {res.ok ? (
          <FbSetup state={res.report.state} detail={res.report.detail} pages={res.report.pages} />
        ) : (
          <FbSetup state={res.why === 'not-set-up' ? 'hq-not-set-up' : 'error'} detail={res.detail} />
        )}
      </div>
    );
  }

  const r = res.report;
  const page = r.page!;
  const p = fbProgress(r, today);
  const posts = r.posts.filter((x) => x.at > 0);
  const pace = p.next?.inDays ? `about ${plural(p.next.inDays, 'day')} at this pace` : null;

  return (
    <div className="appc stack" style={{ ...FB_STYLE, gap: 14 }}>
      {top}

      <div className="apphead">
        <PagePic r={r} />
        <div>
          <h1>{page.name}</h1>
          <small>
            Facebook Page{page.handle ? ` · @${page.handle}` : ''}
            {p.started ? ` · started ${shortDay(p.started)}, day ${p.dayN}` : ''}
          </small>
        </div>
      </div>

      <div className="hero">
        <b>{p.followers === null ? '–' : num(p.followers)}</b>
        <span>{p.followers === 1 ? 'follower' : 'followers'}</span>
        {p.week ? (
          <Pill tone={p.week.change > 0 ? 'up' : p.week.change < 0 ? 'down' : 'flat'}>
            {p.week.change ? signed(p.week.change) : 'No change'} {p.week.full ? 'on a week ago' : `since ${shortDay(p.week.from)}`}
          </Pill>
        ) : null}
      </div>

      {p.next ? (
        <section aria-label="The next round number" className="card">
          <div className="head">
            <h2>
              {p.next.left} more to {num(p.next.at)}
            </h2>
            <span>{pace ?? (p.yesterday ? `${signed(p.yesterday)} since yesterday` : 'Next round number')}</span>
          </div>
          <div className="fb-bar fb-bar-lg" role="img" aria-label={`${p.followers} of ${p.next.at} followers`}>
            <span style={{ width: `${Math.max(2, Math.round(p.next.share * 100))}%` }} />
          </div>
          <div className="split-labels">
            <span>{num(p.next.prev)}</span>
            <span>{num(p.next.at)}</span>
          </div>
        </section>
      ) : null}

      <div className="facts">
        <div className="fact">
          <b>{p.postsWeek}</b>
          <span>
            {p.postsWeek === 1 ? 'post' : 'posts'} in the last 7 days{p.postsBefore ? ` (${p.postsBefore} the week before)` : ''}
          </span>
        </div>
        <div className="fact">
          <b>{p.lastPost ? daysAgo(p.lastPost.days) : '–'}</b>
          <span>{p.lastPost ? `last post, at ${clock(p.lastPost.at)}` : 'no posts yet'}</span>
        </div>
        <div className="fact">
          <b>{p.perPost ? p.perPost.reactions : '–'}</b>
          <span>reactions a post{p.perPost ? `, ${p.perPost.comments} ${p.perPost.comments === 1 ? 'comment' : 'comments'}, ${p.perPost.shares} ${p.perPost.shares === 1 ? 'share' : 'shares'}` : ''}</span>
        </div>
        <div className="fact">
          <b>{p.toAnswer.length}</b>
          <span>{p.toAnswer.length === 1 ? 'comment' : 'comments'} to answer</span>
        </div>
      </div>
      {p.lastPost && p.lastPost.days >= 3 ? <p className="callout">No post for {plural(p.lastPost.days, 'day')}. A new Page grows with something every day or two.</p> : null}

      <div className="split2">
        <FbFollowers days={p.days} since={p.since} />

        <section aria-label="Comments to answer" className="card">
          <div className="head">
            <h2>Comments to answer</h2>
            <span>{p.toAnswer.length ? plural(p.toAnswer.length, 'comment') : 'All answered'}</span>
          </div>
          {p.toAnswer.length ? (
            <ul className="msgs">
              {p.toAnswer.slice(0, 8).map((c) => (
                <li key={c.id} className="msg">
                  <div className="msg-top">
                    <span className="msg-new" aria-hidden="true" />
                    <b style={{ color: 'var(--ink)' }}>{c.who}</b>
                    <span>{when(c.at)}</span>
                  </div>
                  <p className="msg-body">{c.text || '(a picture or sticker)'}</p>
                  <div className="msg-foot">
                    <span>On “{postText(posts.find((x) => x.id === c.post))}”</span>
                    <a href={c.link} target="_blank" rel="noreferrer" className="fb-answer">
                      Answer on Facebook
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{r.comments.length ? 'Every comment has an answer from the Page.' : 'No comments on the latest posts yet.'}</p>
          )}
          <p className="note">
            You can answer from the Job Kit too: Social media,{' '}
            <a href="https://www.rafcarpentry.com/job-kit" target="_blank" rel="noreferrer">
              open the Job Kit
            </a>
            .
          </p>
        </section>
      </div>

      {p.best && posts.length > 1 ? (
        <section aria-label="Best post" className="card">
          <div className="head">
            <h2>Best post so far</h2>
            <span>Of the latest {posts.length}</span>
          </div>
          <PostRow post={p.best} big />
        </section>
      ) : null}

      <section aria-label="Posts" className="card">
        <div className="head">
          <h2>Posts</h2>
          <span>
            {posts.length ? `${num(p.totals.reactions)} reactions · ${num(p.totals.comments)} comments · ${num(p.totals.shares)} shares` : 'None yet'}
          </span>
        </div>
        {posts.length ? (
          <ul className="fbposts">
            {posts.map((x) => (
              <li key={x.id}>
                <PostRow post={x} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing posted on the Page yet.</p>
        )}
      </section>

      <p className="stamp" style={{ textAlign: 'center' }}>
        Read from Facebook {when(r.at)}, {longDay(today)}. Reach and views need Facebook&apos;s Page insights permission, which the Job Kit&apos;s login doesn&apos;t ask for yet.
      </p>
    </div>
  );
}

function postText(x?: PagePost) {
  const t = (x?.text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'a post';
  return t.length > 48 ? `${t.slice(0, 46).trimEnd()}…` : t;
}

function PostRow({ post, big = false }: { post: PagePost; big?: boolean }) {
  return (
    <a className={`fbpost${big ? ' fbpost-lg' : ''}`} href={post.link} target="_blank" rel="noreferrer">
      {post.thumb ? <img src={post.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="fbpost-none" aria-hidden="true" />}
      <span className="fbpost-body">
        <span className="fbpost-when">
          {when(post.at)}
          {post.kind === 'video' ? ' · video' : ''}
        </span>
        <span className="fbpost-text">{post.text || 'A post with no words'}</span>
        <span className="fbpost-nums">
          <b>{post.reactions}</b> {post.reactions === 1 ? 'reaction' : 'reactions'} · <b>{post.comments}</b> {post.comments === 1 ? 'comment' : 'comments'} · <b>{post.shares}</b> {post.shares === 1 ? 'share' : 'shares'}
        </span>
      </span>
    </a>
  );
}
