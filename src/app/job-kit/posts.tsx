'use client';
/* eslint-disable @next/next/no-img-element -- small previews of the post packs, straight from public/social */
import { useEffect, useMemo, useState } from 'react';
import Mark from './mark';

/* Posts: ready-made post packs for Instagram, TikTok and YouTube Shorts (scripts/social-pack.py makes them into
   public/social/<job>/ and content/social/<job>.json). Each button copies the caption and opens the phone's
   share sheet with the video or photos, so Raf picks the app, adds a sound there and posts. Nothing posts by
   itself and no app accounts are connected. What he has posted is ticked on this phone only. */

export type Pack = {
  slug: string;
  title: string;
  place: string;
  job: string;
  made: string;
  video: { src: string; secs: number; bytes: number; w: number; h: number };
  poster: string;
  carousel: { src: string; w: number; h: number }[];
  captions: { instagram: string; tiktok: string; youtube: { title: string; description: string } };
  sound?: string;
};

type Where = 'reel' | 'carousel' | 'tiktok' | 'youtube';
type Posted = Record<string, Partial<Record<Where, string>>>;
const POSTED_KEY = 'raf_jobkit_posted';
const WHERE: Where[] = ['reel', 'carousel', 'tiktok', 'youtube'];
const SHORT: Record<Where, string> = { reel: 'Reel', carousel: 'Photos', tiktok: 'TikTok', youtube: 'YouTube' };

function readPosted(): Posted {
  try {
    return JSON.parse(localStorage.getItem(POSTED_KEY) || '{}') as Posted;
  } catch {
    return {};
  }
}

function usePosted() {
  const [posted, setPosted] = useState<Posted>(() => (typeof window === 'undefined' ? {} : readPosted()));
  const toggle = (slug: string, where: Where) => {
    const now = readPosted();
    const mine = { ...(now[slug] || {}) };
    if (mine[where]) delete mine[where];
    else mine[where] = new Date().toISOString().slice(0, 10);
    const next = { ...now, [slug]: mine };
    try {
      localStorage.setItem(POSTED_KEY, JSON.stringify(next));
    } catch {
      /* private mode: kept until the app closes */
    }
    setPosted(next);
  };
  return { posted, toggle };
}

const mb = (b: number) => `${(b / 1e6).toFixed(b >= 1e7 ? 0 : 1)} MB`;

/* Copy text in the same tap as the share (the old way works without waiting, so the share sheet still opens). */
function copyNow(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    document.execCommand('copy');
    ta.remove();
  } catch {
    /* fall through to the clipboard API */
  }
  navigator.clipboard?.writeText(text).catch(() => {});
}

/* ---------- the list ---------- */

export function PostsList({ packs, onOpen }: { packs: Pack[]; onOpen: (slug: string) => void }) {
  const { posted } = usePosted();
  const order = useMemo(() => {
    const left = (p: Pack) => WHERE.filter((w) => !posted[p.slug]?.[w]).length;
    return [...packs].sort((a, b) => Number(left(a) === 0) - Number(left(b) === 0));
  }, [packs, posted]);
  return (
    <div className="pt-7">
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Posts</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        Each job made into a short video, a set of photos and the captions. Tap a button, pick the app, add a sound there and post. About 3 a week keeps the accounts busy.
      </p>
      {order.length ? (
        <ul className="mt-6 grid gap-3">
          {order.map((p, i) => {
            const done = WHERE.filter((w) => posted[p.slug]?.[w]);
            return (
              <li key={p.slug}>
                <button type="button" onClick={() => onOpen(p.slug)} className="flex w-full items-stretch gap-3 rounded-sm border border-line-strong bg-mount p-2.5 text-left transition-colors hover:border-ink">
                  <img src={p.poster} alt="" className="h-[112px] w-[63px] shrink-0 rounded-sm bg-raised object-cover" />
                  <span className="min-w-0 flex-1 py-0.5">
                    {i === 0 && done.length < WHERE.length ? <span className="kicker block text-[12.5px]">Next up</span> : null}
                    <span className="block truncate text-[16.5px] font-semibold leading-snug">{p.title}</span>
                    <span className="block truncate text-[14.5px] text-muted">{p.place}</span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px] text-faint">
                      {WHERE.map((w) => (
                        <span key={w} className="inline-flex items-center gap-1">
                          <Mark state={posted[p.slug]?.[w] ? 'sent' : 'waiting'} />
                          {SHORT[w]}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-7 font-mono text-[13.5px] text-faint">No posts ready yet. Claude makes them from finished jobs.</p>
      )}
    </div>
  );
}

/* ---------- one pack ---------- */

type Got = { video?: File; url?: string; photos?: File[]; progress: number; error?: string };

async function fetchFile(url: string, name: string, type: string, onBytes?: (n: number) => void): Promise<File> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(String(res.status));
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as BlobPart);
    got += value.length;
    onBytes?.(got);
  }
  return new File(chunks, name, { type });
}

export function PostView({ pack }: { pack: Pack }) {
  const { posted, toggle } = usePosted();
  const [got, setGot] = useState<Got>({ progress: 0 });
  const [note, setNote] = useState('');
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  // Download the video (and then the photos) as soon as the pack opens: the share sheet only opens straight
  // from a tap, so the files must already be on the phone by then. Kept in memory, gone when the app closes.
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    (async () => {
      try {
        const video = await fetchFile(pack.video.src, `${pack.slug}.mp4`, 'video/mp4', (n) => live && setGot((g) => ({ ...g, progress: n / pack.video.bytes })));
        if (!live) return;
        // The preview then plays the copy on the phone instead of downloading it again.
        made = URL.createObjectURL(video);
        setGot((g) => ({ ...g, video, url: made, progress: 1 }));
        const photos = await Promise.all(pack.carousel.map((c, i) => fetchFile(c.src, `${pack.slug}-${String(i + 1).padStart(2, '0')}.jpg`, 'image/jpeg')));
        if (live) setGot((g) => ({ ...g, photos }));
      } catch {
        if (live) setGot((g) => ({ ...g, error: 'No signal: the video has to download first. Try again with signal.' }));
      }
    })();
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [pack]);

  const share = async (files: File[] | undefined, caption: string, where: Where) => {
    if (!files?.length) return;
    copyNow(caption);
    const data = { files };
    if (canShareFiles && navigator.canShare(data)) {
      try {
        await navigator.share(data);
        setNote(`Caption copied. When it’s posted, tick “${SHORT[where]} posted” below.`);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setNote('The share sheet would not open. Try again, or use Save.');
      }
      return;
    }
    // No share sheet (a computer): save the files instead.
    for (const f of files) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    setNote('Saved to Downloads, and the caption is copied.');
  };

  const ready = Boolean(got.video);
  const yt = `${pack.captions.youtube.title}\n\n${pack.captions.youtube.description}`;

  return (
    <div className="pt-5">
      <p className="kicker">{pack.place}</p>
      <h1 className="mt-1 font-display text-[28px] font-[680] leading-[1.05] tracking-[-0.025em]">{pack.title}</h1>

      <div className="mt-5 flex gap-4">
        <video src={got.url ?? pack.video.src} poster={pack.poster} controls playsInline preload="metadata" className="w-[46%] max-w-[240px] shrink-0 rounded-sm bg-ink" style={{ aspectRatio: '9 / 16' }} />
        <div className="min-w-0 text-[14.5px] leading-relaxed text-muted">
          <p className="font-mono text-[12.5px] text-faint">
            {Math.round(pack.video.secs)} s · {mb(pack.video.bytes)} · {pack.carousel.length} photos
          </p>
          <p className="mt-2">The video has no sound on purpose. Add a sound in the app when you post: it’s licensed there, and posts with a sound get shown to more people.</p>
          <p className="mt-2 font-mono text-[12.5px]">
            {got.error ? <span className="text-ink">{got.error}</span> : ready ? (got.photos ? 'Ready to share.' : 'Video ready. Getting the photos…') : `Getting it ready… ${Math.round(got.progress * 100)}%`}
          </p>
        </div>
      </div>

      {note ? (
        <p role="status" className="mt-4 rounded-sm border border-accent bg-accent-soft px-3 py-2.5 text-[14.5px]">
          {note}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3">
        <Platform
          title="Instagram Reel"
          done={posted[pack.slug]?.reel}
          onDone={() => toggle(pack.slug, 'reel')}
          button="Share the video"
          disabled={!ready}
          onShare={() => share(got.video && [got.video], pack.captions.instagram, 'reel')}
          caption={pack.captions.instagram}
          steps={['Pick Instagram, then Reel.', 'Add a sound: tap the music note, pick a track. Business accounts get the cleared ones.', 'Paste the caption and share.']}
          tick="Reel posted"
        />
        <Platform
          title="Instagram photos (carousel)"
          done={posted[pack.slug]?.carousel}
          onDone={() => toggle(pack.slug, 'carousel')}
          button={`Share the ${pack.carousel.length} photos`}
          disabled={!got.photos}
          onShare={() => share(got.photos, pack.captions.instagram, 'carousel')}
          caption={pack.captions.instagram}
          steps={['Pick Instagram, then Post. They stay in this order.', 'No Instagram in the list? Tap Save Images, post them from Instagram, then delete them from Photos.', 'Paste the caption and share.']}
          tick="Photos posted"
        />
        <Platform
          title="TikTok"
          done={posted[pack.slug]?.tiktok}
          onDone={() => toggle(pack.slug, 'tiktok')}
          button="Share the video"
          disabled={!ready}
          onShare={() => share(got.video && [got.video], pack.captions.tiktok, 'tiktok')}
          caption={pack.captions.tiktok}
          steps={['Pick TikTok.', 'Tap Add sound and pick from Commercial sounds (the ones a business account can use).', 'Paste the caption and post.']}
          tick="TikTok posted"
        />
        <Platform
          title="YouTube Short"
          done={posted[pack.slug]?.youtube}
          onDone={() => toggle(pack.slug, 'youtube')}
          button="Share the video"
          disabled={!ready}
          onShare={() => share(got.video && [got.video], yt, 'youtube')}
          caption={yt}
          steps={['Pick YouTube. Not in the list? Tap Save Video, then in YouTube tap +, then Short, pick it, and delete it from Photos after.', 'Tap Add sound and pick one from the list.', 'Paste the title in the title box and the rest in the description.']}
          tick="Short posted"
        />
      </div>

      <a href={pack.job} className="link-more mt-8 text-[15px]">
        See the job page <span aria-hidden>→</span>
      </a>
    </div>
  );
}

function Platform({
  title,
  done,
  onDone,
  button,
  disabled,
  onShare,
  caption,
  steps,
  tick,
}: {
  title: string;
  done?: string;
  onDone: () => void;
  button: string;
  disabled: boolean;
  onShare: () => void;
  caption: string;
  steps: string[];
  tick: string;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section className={`rounded-sm border bg-mount p-3.5 ${done ? 'border-line' : 'border-line-strong'}`}>
      <h2 className="flex items-center gap-2 text-[16.5px] font-semibold">
        {done ? <Mark state="sent" /> : null}
        {title}
      </h2>
      <ol className="mt-2 grid list-decimal gap-1 pl-5 text-[14.5px] leading-snug text-muted">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <button type="button" className={`btn btn-sm mt-3 w-full ${done ? 'btn-ghost' : 'btn-primary'}`} disabled={disabled} onClick={onShare}>
        {disabled ? 'Getting it ready…' : button}
      </button>
      <p className="mt-1.5 font-mono text-[12px] text-faint">The caption is copied when you tap it.</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="h-9 text-[14.5px] font-semibold text-accent" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide the caption' : 'Show the caption'}
        </button>
        <label className="flex h-9 items-center gap-2 text-[14.5px]">
          <input type="checkbox" checked={Boolean(done)} onChange={onDone} className="h-5 w-5 accent-accent" />
          {tick}
          {done ? <span className="font-mono text-[12px] text-faint">{done}</span> : null}
        </label>
      </div>
      {show ? (
        <div className="mt-2">
          <p className="whitespace-pre-wrap rounded-sm border border-line bg-paper px-3 py-2.5 text-[14.5px] leading-relaxed">{caption}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2"
            onClick={() => {
              copyNow(caption);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy the caption'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
