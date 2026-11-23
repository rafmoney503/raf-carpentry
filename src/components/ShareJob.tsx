'use client';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

/* A job page's Share button (Raf, 23 Nov 2026: 'add to each job a share button for link to automatically copy and
   share or send it through whatsapp or message'). Beside Save for my brief, outlined like it, so it never pulls the eye
   from Get a quote.
   - A phone (a finger and the browser's share list): one tap opens the phone's own share list (WhatsApp, Messages,
     email, AirDrop ...) with the job's link and one line; the link shows the job's sharing picture in the chat.
   - A computer, or a phone with no share list: a small menu, Copy link, Send on WhatsApp, Email it.
   Each link carries ?utm_source=share (the phone's list), share-copy, share-wa or share-email, so a visit that came from
   one reads as such in the Job Kit (SOURCE_LABEL), and each tap carries data-share='<how>:<slug>' for the visit counter
   (SiteStats sh, rafsite_shares): the Job Kit's Website stats, Jobs shared. */

type How = 'sheet' | 'copy' | 'wa' | 'email';

// the phone's own share list: there with a finger and navigator.share (never on the server's first paint)
const noSub = () => () => {};
const hasSheet = () => typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
const TAG: Record<How, string> = { sheet: 'share', copy: 'share-copy', wa: 'share-wa', email: 'share-email' };

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
      <path d="M12 3v12M8 7l4-4 4 4M5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
    </svg>
  );
}

export default function ShareJob({ slug, title, area }: { slug: string; title: string; area: string }) {
  const sheet = useSyncExternalStore(noSub, hasSheet, () => false);
  const [open, setOpen] = useState(false);
  const [right, setRight] = useState(false); // the menu opens leftwards when the button sits near the right edge
  const [up, setUp] = useState(false); // and upwards when there's no room under it (clear of the floating buttons)
  const [note, setNote] = useState<'' | 'copied' | 'shared'>('');
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const noteTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    },
    [],
  );

  const link = (how: How) => `${window.location.origin}/portfolio/${slug}?utm_source=${TAG[how]}`;
  const name = `${title}, ${area}`;
  const line = `${name}. Made by Raf Carpentry.`;

  const flash = (n: 'copied' | 'shared') => {
    setNote(n);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(''), 2600);
  };

  const close = (focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  };

  // where the menu goes, worked out before it's painted
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    setRight(r.left + 280 > window.innerWidth - 12);
    setUp(r.bottom + 8 + 240 > window.innerHeight - 88 && r.top - 8 - 240 > 72);
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  // Escape, a click outside or Tab away closes it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
        if (next) {
          e.preventDefault();
          next.focus();
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  const onButton = async () => {
    if (!sheet) {
      setOpen((o) => !o);
      return;
    }
    try {
      await navigator.share({ title: name, text: line, url: link('sheet') });
      flash('shared');
    } catch (e) {
      // closed the share list: nothing to do; anything else (not allowed here): the menu instead
      if ((e as Error)?.name !== 'AbortError') setOpen(true);
    }
  };

  const copy = async () => {
    const url = link('copy');
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // older browsers: the hidden-box way
      const box = document.createElement('textarea');
      box.value = url;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing more to try */
      }
      box.remove();
    }
    flash('copied');
    close();
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`${line} ${typeof window === 'undefined' ? '' : link('wa')}`)}`;
  const mail = `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(
    `Have a look at this one: ${name}, made by Raf Carpentry.\n\n${typeof window === 'undefined' ? '' : link('email')}`,
  )}`;

  const item = 'flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[15.5px] text-ink transition-colors hover:bg-raised focus-visible:bg-raised focus-visible:outline-none';

  return (
    <div className="relative" data-share-job={slug}>
      <button
        ref={btn}
        type="button"
        onClick={onButton}
        data-share={sheet ? `sheet:${slug}` : undefined}
        aria-haspopup={sheet ? undefined : 'menu'}
        aria-expanded={sheet ? undefined : open}
        className="btn btn-ghost gap-2.5 border"
      >
        <ShareIcon />
        {note === 'copied' ? 'Link copied' : note === 'shared' ? 'Shared' : 'Share this job'}
        {note ? (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" className="flex-none text-accent">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {note === 'copied' ? 'Link copied' : note === 'shared' ? 'Shared' : ''}
      </span>
      {open ? (
        <div
          ref={menu}
          role="menu"
          aria-label="Share this job"
          data-share-menu
          className={`absolute ${up ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'} z-40 w-[272px] max-w-[calc(100vw-24px)] overflow-hidden rounded-sm border border-line-strong bg-mount shadow-[0_12px_32px_rgb(22_25_28/0.16)] ${right ? 'right-0' : 'left-0'}`}
        >
          <button type="button" role="menuitem" onClick={copy} data-share={`copy:${slug}`} className={item}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="flex-none">
              <rect x="8" y="8" width="12" height="12" rx="1.5" />
              <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
            </svg>
            Copy link
          </button>
          <a href={wa} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => close(false)} data-share={`wa:${slug}`} className={`${item} border-t border-line`}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="flex-none text-whatsapp" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z" />
            </svg>
            Send on WhatsApp
          </a>
          <a href={mail} role="menuitem" onClick={() => close(false)} data-share={`email:${slug}`} className={`${item} border-t border-line`}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="flex-none">
              <rect x="3" y="5" width="18" height="14" rx="1.5" />
              <path d="M3.5 6l8.5 7 8.5-7" />
            </svg>
            Email it
          </a>
          <p className="border-t border-line bg-raised px-4 py-2.5 font-mono text-[12px] leading-snug text-faint">The link shows this job&apos;s photo in the chat.</p>
        </div>
      ) : null}
    </div>
  );
}
