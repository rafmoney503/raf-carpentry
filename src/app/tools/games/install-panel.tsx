'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { canPrompt, isStandalone, justInstalled, keepGamesOffline, onInstallChange, osOf, promptInstall, type Os } from '@/lib/workshop-games/install';
import { GAMES_OPEN, GAMES_SCREENS, GAMES_SHORT } from '@/lib/workshop-games/site';
import { AddIcon, MenuIcon, ShareIcon } from '../workshop/install-panel';

/* The top of /tools/games: Play, and how to keep the games on this phone, for the phone it is on (iPhone: Share
   then Add to Home Screen; Android and Chrome on a computer: the browser's own Install; a computer: a QR code to
   scan). Opened from the home screen, this page goes straight to the games. The same as Workshop Tools' panel. */

export default function GamesInstallPanel({ qrSvg }: { qrSvg: string }) {
  const [os, setOs] = useState<Os>('');
  const [can, setCan] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      location.replace(GAMES_OPEN);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the phone is only known in the browser
    setOs(osOf());
    setCan(canPrompt());
    const off = onInstallChange(() => {
      setCan(canPrompt());
      if (justInstalled()) setDone(true);
    });
    keepGamesOffline();
    return off;
  }, []);

  const install = async () => {
    const r = await promptInstall();
    if (r === 'accepted') setDone(true);
    setCan(canPrompt());
  };

  let how: React.ReactNode;
  if (done) {
    how = <>Installed. Find <strong className="font-semibold text-ink">Workshop Games</strong> on your home screen.</>;
  } else if (can) {
    how = os === 'desktop'
      ? <>Install them on this computer, or scan the code with your phone to put them there.</>
      : <>Tap <strong className="font-semibold text-ink">Install it</strong> and the games go on your home screen like any other app.</>;
  } else if (os === 'ios') {
    how = <>To keep them: tap Share <ShareIcon /> in Safari (on newer iPhones it is in the <MenuIcon className="h-[16px] w-[16px] rotate-90" /> menu), then <strong className="font-semibold text-ink">Add to Home Screen</strong> <AddIcon />.</>;
  } else if (os === 'ios-other') {
    how = <>To keep them: tap Share <ShareIcon /> beside the address bar, then <strong className="font-semibold text-ink">Add to Home Screen</strong> <AddIcon />.</>;
  } else if (os === 'android') {
    how = <>To keep them: open the browser menu <MenuIcon />, then <strong className="font-semibold text-ink">Install app</strong> or <strong className="font-semibold text-ink">Add to Home screen</strong>.</>;
  } else if (os === 'desktop') {
    how = <>Made for your phone. Scan the code with the camera, or type <span className="font-mono text-ink">{GAMES_SHORT}</span>.</>;
  } else {
    how = <>iPhone: Share, then Add to Home Screen. Android: Install app in the browser menu.</>;
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center gap-3">
        <a href={GAMES_OPEN} className="btn btn-primary gap-2">
          Play the games <span aria-hidden="true">→</span>
        </a>
        {can && !done ? (
          <button type="button" onClick={install} className="btn btn-ghost gap-2">
            <AddIcon /> Install it
          </button>
        ) : null}
      </div>
      <div className={`mt-5 grid items-center gap-5 ${os === 'desktop' ? 'sm:grid-cols-[120px_minmax(0,1fr)]' : ''}`}>
        {os === 'desktop' ? (
          <div className="mount w-[120px] p-2" aria-label={`QR code for ${GAMES_SHORT}`} role="img">
            <div className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
        ) : null}
        <p className="max-w-[52ch] text-[15.5px] leading-relaxed text-muted" aria-live="polite">{how}</p>
      </div>
    </div>
  );
}

/* The games on a phone, beside the words. A picture of the home screen; on a computer, Try it here swaps the
   picture for the games themselves, working, in the same frame. */
export function GamesPhone() {
  const [live, setLive] = useState(false);
  return (
    <figure className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[40px] bg-ink p-[9px] shadow-[0_24px_48px_-20px_rgba(22,25,28,0.45)]">
        <div className="relative aspect-[390/844] overflow-hidden rounded-[31px] bg-[#121518]">
          {live ? (
            <iframe src={GAMES_OPEN} title="Workshop Games, working" className="absolute inset-0 h-full w-full border-0" allow="autoplay" />
          ) : (
            <Image src={GAMES_SCREENS.home.src} alt={GAMES_SCREENS.home.alt} fill sizes="300px" className="object-cover" priority />
          )}
        </div>
      </div>
      <figcaption className="mt-4 hidden text-center lg:block">
        {live ? (
          <span className="font-mono text-[13px] text-faint">The real games. Click away.</span>
        ) : (
          <button type="button" onClick={() => setLive(true)} className="link-more text-[15px]">
            Try it here <span aria-hidden="true">→</span>
          </button>
        )}
      </figcaption>
    </figure>
  );
}
