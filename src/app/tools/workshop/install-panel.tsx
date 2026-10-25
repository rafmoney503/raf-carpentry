'use client';
import { useEffect, useState } from 'react';
import { canPrompt, isStandalone, justInstalled, keepOffline, onInstallChange, osOf, promptInstall, type Os } from '@/lib/workshop-tools/install';
import { APP_OPEN, APP_SHORT } from '@/lib/workshop-tools/site';

/* The top of /tools/workshop: Open the app, and how to keep it on this phone, for the phone it is on (iPhone:
   Share then Add to Home Screen; Android and Chrome on a computer: the browser's own Install; a computer: a QR code
   to scan). Opened from the home screen, this page goes straight to the app. */

export function ShareIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block align-[-3px] ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5v10h14V11h-1" />
    </svg>
  );
}

export function AddIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block align-[-3px] ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function MenuIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block align-[-3px] ${className}`} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export default function InstallPanel({ qrSvg }: { qrSvg: string }) {
  const [os, setOs] = useState<Os>('');
  const [can, setCan] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      location.replace(APP_OPEN);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the phone is only known in the browser
    setOs(osOf());
    setCan(canPrompt());
    const off = onInstallChange(() => {
      setCan(canPrompt());
      if (justInstalled()) setDone(true);
    });
    keepOffline();
    return off;
  }, []);

  const install = async () => {
    const r = await promptInstall();
    if (r === 'accepted') setDone(true);
    setCan(canPrompt());
  };

  let how: React.ReactNode;
  if (done) {
    how = <>Installed. Find <strong className="font-semibold text-ink">Workshop Tools</strong> on your home screen.</>;
  } else if (can) {
    how = os === 'desktop'
      ? <>Install it on this computer, or scan the code with your phone to put it there.</>
      : <>Tap <strong className="font-semibold text-ink">Install it</strong> and it goes on your home screen like any other app.</>;
  } else if (os === 'ios') {
    how = <>To keep it: tap Share <ShareIcon /> in Safari (on newer iPhones it is in the <MenuIcon className="h-[16px] w-[16px] rotate-90" /> menu), then <strong className="font-semibold text-ink">Add to Home Screen</strong> <AddIcon />.</>;
  } else if (os === 'ios-other') {
    how = <>To keep it: tap Share <ShareIcon /> beside the address bar, then <strong className="font-semibold text-ink">Add to Home Screen</strong> <AddIcon />.</>;
  } else if (os === 'android') {
    how = <>To keep it: open the browser menu <MenuIcon />, then <strong className="font-semibold text-ink">Install app</strong> or <strong className="font-semibold text-ink">Add to Home screen</strong>.</>;
  } else if (os === 'desktop') {
    how = <>It&apos;s made for your phone. Scan the code with the camera, or type <span className="font-mono text-ink">{APP_SHORT}</span>.</>;
  } else {
    how = <>iPhone: Share, then Add to Home Screen. Android: Install app in the browser menu.</>;
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center gap-3">
        <a href={APP_OPEN} className="btn btn-primary gap-2">
          Open the app <span aria-hidden="true">→</span>
        </a>
        {can && !done ? (
          <button type="button" onClick={install} className="btn btn-ghost gap-2">
            <AddIcon /> Install it
          </button>
        ) : null}
      </div>
      <div className={`mt-5 grid items-center gap-5 ${os === 'desktop' ? 'sm:grid-cols-[120px_minmax(0,1fr)]' : ''}`}>
        {os === 'desktop' ? (
          <div className="mount w-[120px] p-2" aria-label={`QR code for ${APP_SHORT}`} role="img">
            <div className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
        ) : null}
        <p className="max-w-[52ch] text-[15.5px] leading-relaxed text-muted" aria-live="polite">{how}</p>
      </div>
    </div>
  );
}
