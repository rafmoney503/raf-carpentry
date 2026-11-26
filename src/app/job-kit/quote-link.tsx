'use client';

/* Send my quote link (26 Nov 2026, Raf: "Can you make a shortcut or link for quote so I can send it to new customers so
   they know what to do ... so I don't have to search for it and also send easily"): on Today, in the Customers box.
   WhatsApp opens with the message typed in and no number, so WhatsApp asks which chat; Text does the same in Messages;
   Copy for anywhere else; Share opens the phone's share list (Instagram, Messenger, email), else copies. */

import { useState } from 'react';
import { QUOTE_LINK_SHORT, quoteLinkMessage } from '@/lib/quote-link';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function QuoteLinkBox() {
  const [note, setNote] = useState('');
  const [show, setShow] = useState(false);
  const text = quoteLinkMessage();
  const say = (s: string) => {
    setNote(s);
    window.setTimeout(() => setNote(''), 3000);
  };
  const copy = async () => say((await copyText(text)) ? 'Copied: paste it into any chat.' : 'Couldn’t copy here. Press and hold the message below to copy it.');
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    await copy();
  };
  return (
    <div data-quote-link className="border-b border-line py-3">
      <p className="font-semibold">Send my quote link</p>
      <p className="mt-0.5 text-[14.5px] text-muted">
        <span className="font-mono text-[13.5px] text-ink">{QUOTE_LINK_SHORT}</span> · the free quote form, 3 quick steps
      </p>
      <a data-quote-link-wa href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className="btn btn-whatsapp mt-2.5 w-full">
        Send on WhatsApp
      </a>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <a data-quote-link-text href={`sms:?&body=${encodeURIComponent(text)}`} className="btn btn-ghost btn-sm w-full">
          Text
        </a>
        <button type="button" data-quote-link-copy onClick={() => void copy()} className="btn btn-ghost btn-sm w-full">
          Copy
        </button>
        <button type="button" data-quote-link-share onClick={() => void share()} className="btn btn-ghost btn-sm w-full">
          Share
        </button>
      </div>
      {note ? (
        <p role="status" className="mt-2 text-[14px] font-semibold">
          {note}
        </p>
      ) : null}
      <button type="button" onClick={() => setShow((s) => !s)} aria-expanded={show} className="mt-1.5 py-1 text-left font-mono text-[12.5px] text-faint underline">
        {show ? 'Hide the message' : 'See the message'}
      </button>
      {show ? (
        <p data-quote-link-message className="mt-1 whitespace-pre-line rounded-sm border border-line bg-paper px-3 py-2 text-[14.5px] leading-relaxed [overflow-wrap:anywhere]">
          {text}
        </p>
      ) : null}
    </div>
  );
}
