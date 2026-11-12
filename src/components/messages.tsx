'use client';

import { useState } from 'react';
import type { TellMessage } from '@/lib/db';

const KIND: Record<TellMessage['kind'], string> = { idea: 'Idea', broke: 'Something didn’t work', stuck: 'Got stuck', liked: 'Liked it' };
const WHO: Record<string, string> = { child: 'a child', adult: 'a grown-up', teacher: 'a teacher' };
const LANG: Record<string, string> = { en: 'English', de: 'German', es: 'Spanish', fr: 'French', pl: 'Polish', uk: 'Ukrainian' };

function when(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

async function mark(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  return Boolean(res?.ok);
}

/* The messages, newest first; each can be marked read (and back), or all at once. */
export function MessagesList({ items }: { items: TellMessage[] }) {
  const [read, setRead] = useState<Record<number, boolean>>(() => Object.fromEntries(items.map((m) => [m.id, Boolean(m.read_at)])));
  const [problem, setProblem] = useState('');
  const unread = items.filter((m) => !read[m.id]).length;

  async function toggle(id: number) {
    const to = !read[id];
    setRead((r) => ({ ...r, [id]: to }));
    if (!(await mark({ ids: [id], read: to }))) {
      setRead((r) => ({ ...r, [id]: !to }));
      setProblem('That didn’t save. Try again.');
    } else setProblem('');
  }

  async function all() {
    const before = read;
    setRead(Object.fromEntries(items.map((m) => [m.id, true])));
    if (!(await mark({ all: true }))) {
      setRead(before);
      setProblem('That didn’t save. Try again.');
    } else setProblem('');
  }

  return (
    <section aria-label="Messages" className="card">
      <div className="head">
        <h2>{unread ? `${unread} new` : 'All read'}</h2>
        {unread ? (
          <button type="button" className="btn" onClick={all} data-msg-all>
            Mark all read
          </button>
        ) : (
          <span>{items.length} in all</span>
        )}
      </div>
      {problem ? <p role="alert">{problem}</p> : null}
      <ul className="msgs">
        {items.map((m) => (
          <li key={m.id} className="msg" data-read={read[m.id]} data-msg={m.id}>
            <div className="msg-top">
              {!read[m.id] ? <span className="msg-new" aria-label="New" /> : null}
              <span className="msg-kind" data-kind={m.kind}>
                {KIND[m.kind] ?? m.kind}
              </span>
              <span>{when(m.created_at)}</span>
              {m.who ? <span>· from {WHO[m.who] ?? m.who}</span> : null}
            </div>
            <p className="msg-body">{m.body}</p>
            <div className="msg-foot">
              <a href={`https://builditin3d.com${m.page}`} target="_blank" rel="noreferrer">
                {m.page}
              </a>
              <span>{LANG[m.lang] ?? m.lang}</span>
              <button type="button" onClick={() => toggle(m.id)} data-msg-read={m.id}>
                {read[m.id] ? 'Mark as new' : 'Mark as read'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
