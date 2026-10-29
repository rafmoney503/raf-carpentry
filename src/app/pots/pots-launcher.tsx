'use client';
import { useEffect, useState } from 'react';

const APP_URL = 'https://claude.ai/artifact/X5sV5mmaSZb32gF8zMuz5k';

export default function PotsLauncher() {
  const [going, setGoing] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('go')) {
      setGoing(true);
      window.location.replace(APP_URL);
      return;
    }
    // so the icon added to the home screen from here opens the app straight away
    window.history.replaceState(window.history.state, '', '/pots?go=1');
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#0a1641] text-white flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/money-pots/icon-512.png" alt="" width={132} height={132} className="rounded-[30px] shadow-[0_18px_50px_rgba(34,200,140,.35)]" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Money pots</h1>
        <p className="text-white/70 max-w-sm">{going ? 'Opening…' : 'Rafal Solutions Ltd: what to put aside, what you can spend, and every deadline.'}</p>
      </div>
      {!going && (
        <ol className="text-left max-w-sm w-full flex flex-col gap-3 text-[15px]">
          <li className="flex gap-3"><b className="font-mono text-[#5fe3a1]">1</b><span>In Safari, tap <b>Share</b> (the square with the arrow; on newer iPhones it is in the <b>•••</b> menu by the address bar).</span></li>
          <li className="flex gap-3"><b className="font-mono text-[#5fe3a1]">2</b><span>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
          <li className="flex gap-3"><b className="font-mono text-[#5fe3a1]">3</b><span>Open it from the green £ icon. It goes straight to your pots. Stay signed in to Claude in Safari.</span></li>
        </ol>
      )}
      <a href={APP_URL} className="inline-flex items-center justify-center min-h-12 px-6 rounded-[2px] bg-[#5fe3a1] text-[#0a1641] font-semibold">Open Money pots now</a>
    </div>
  );
}
