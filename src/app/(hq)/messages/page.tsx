import Link from 'next/link';
import { MessagesList } from '@/components/messages';
import { dbReady, hqApi, type TellReport } from '@/lib/db';
import { plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

const COURSE: Record<string, string> = {
  'bird-box': 'Bird box',
  'planter-box': 'Planter box',
  'alcove-shelves': 'Alcove shelves',
  'log-store': 'Log store',
  'raised-bed': 'Raised bed',
  'cabinet-making': 'Cabinet making (wardrobe)',
};
const courseName = (slug: string) => COURSE[slug] ?? slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/* What people sent with Tell us on builditin3d.com, newest first, and how the lessons felt (the faces on a passed
   lesson, the last 90 days). Read straight from Supabase each time (hq_api 'suggestions'). */
export default async function MessagesPage() {
  let rep: TellReport | null = null;
  let problem = '';
  if (!dbReady()) problem = 'HQ isn’t connected to Supabase yet.';
  else {
    try {
      rep = await hqApi<TellReport>('suggestions', { limit: 200 });
    } catch (e) {
      problem = `Supabase didn’t answer (${(e as Error).message}).`;
    }
  }

  const lessons = new Map<string, { course: string; lesson: number; easy: number; right: number; hard: number }>();
  for (const r of rep?.ratings ?? []) {
    const k = `${r.course}:${r.lesson}`;
    const row = lessons.get(k) ?? { course: r.course, lesson: r.lesson, easy: 0, right: 0, hard: 0 };
    row[r.rating] += r.n;
    lessons.set(k, row);
  }
  const faces = [...lessons.values()].sort((a, b) => b.hard / (b.easy + b.right + b.hard) - a.hard / (a.easy + a.right + a.hard) || a.course.localeCompare(b.course) || a.lesson - b.lesson);

  return (
    <>
      <div className="hello">
        <p>Build It in 3D · Tell us</p>
        <h1>Messages</h1>
        <p className="lead">
          {rep
            ? rep.items.length
              ? `${rep.unread ? `${plural(rep.unread, 'new message')}. ` : 'All read. '}What people sent from the Tell us button on builditin3d.com. Nobody’s name or email comes with them.`
              : 'Nothing yet. Messages from the Tell us button on builditin3d.com land here.'
            : problem}
        </p>
      </div>

      {rep && rep.items.length ? <MessagesList items={rep.items} /> : null}

      {faces.length ? (
        <section aria-label="How the lessons felt" className="card">
          <div className="head">
            <h2>How the lessons felt</h2>
            <span>faces on a passed lesson, 90 days</span>
          </div>
          <ul className="faces">
            {faces.map((f) => {
              const all = f.easy + f.right + f.hard;
              return (
                <li key={`${f.course}:${f.lesson}`}>
                  <span>
                    {courseName(f.course)}, lesson {f.lesson}
                  </span>
                  <small>
                    {f.easy} easy · {f.right} just right · {f.hard} hard
                  </small>
                  <span className="split" role="img" aria-label={`${f.easy} easy, ${f.right} just right, ${f.hard} hard`}>
                    <span style={{ width: `${(f.easy / all) * 100}%`, background: '#8fe0b0' }} />
                    <span style={{ width: `${(f.right / all) * 100}%`, background: 'var(--yellow)' }} />
                    <span style={{ width: `${(f.hard / all) * 100}%`, background: '#ffb08a' }} />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="note">Hardest first. A lesson most people call hard is the one to look at.</p>
        </section>
      ) : null}

      <p className="stamp">
        <Link href="/">Back to Today</Link>
      </p>
    </>
  );
}
