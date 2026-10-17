'use client';

import Link from 'next/link';
import { useState } from 'react';
import ShapeScene, { type SceneName } from './ShapeScene';

/* Home page, after the numbers: the two moving scenes take turns (ShapeScene mode 'both'), and the heading and line
   change with whichever is playing. Both lines are on the page; the one not showing is hidden from screen readers. */

const WORDS: Record<SceneName, { title: string; line: string }> = {
  loop: { title: 'Rough in, finished out.', line: 'An enquiry goes in once, photos and all, and comes out as a ServiceM8 job. Nothing typed twice.' },
  cog: { title: 'Everything turns together.', line: 'Your website, ServiceM8 and your phone run as one, so a job moved in one place moves everywhere.' },
};

export default function SystemsBand() {
  const [scene, setScene] = useState<SceneName>('loop');
  return (
    <section className="sys-band grid-paper" aria-labelledby="sys-band-title">
      <div className="wrap sys-row">
        <div className="sys-text">
          <p className="kicker">What a system does</p>
          <h2 className="h2 sys-swap" id="sys-band-title">
            {(Object.keys(WORDS) as SceneName[]).map((k) => (
              <span key={k} className={scene === k ? 'on' : undefined} aria-hidden={scene !== k}>
                {WORDS[k].title}
              </span>
            ))}
          </h2>
          <p className="lead sys-swap">
            {(Object.keys(WORDS) as SceneName[]).map((k) => (
              <span key={k} className={scene === k ? 'on' : undefined} aria-hidden={scene !== k}>
                {WORDS[k].line}
              </span>
            ))}
          </p>
          <Link href="/how-it-works" className="link-more">
            How I build one <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ShapeScene mode="both" place="band" onScene={setScene} />
      </div>
    </section>
  );
}
