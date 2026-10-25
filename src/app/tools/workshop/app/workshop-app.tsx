'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as APP from '@/lib/workshop-tools/app.generated';
import { DcRoot, type DCLogic, type DcApp } from '@/lib/workshop-tools/dc-runtime';
import { canPrompt, isStandalone, justInstalled, keepOffline, onInstallChange, osOf, promptInstall, proOnSale } from '@/lib/workshop-tools/install';
import SpiritLevel from '@/app/tools/spirit-level/spirit-level';
import ReadingsList from '@/app/tools/readings/readings-list';
import './workshop-app.css';

/* The Workshop Tools app, full screen (no menu, footer or floating buttons: LayoutShell). The app is the one
   designed on the canvas; this hands it what only the page knows: how this phone adds apps to its home screen
   (the 'Keep it on your phone' card on its home), whether Pro is on sale yet, and the offline copy.

   Spirit level (25 Oct 2026, Raf: 'check the functionality of the other spirit level and see if we can upgrade the
   one in workshop tools ... having two spirit levels online maybe is too much'): the app's Spirit level tile opens
   the website's own level (src/app/tools/spirit-level/spirit-level.tsx: set zero, flip check, the mm to pack, tone,
   speak, big numbers, save), started inside the tile's tap so an iPhone can ask for motion. The canvas's simpler
   level screen is never shown here. Your readings opens over the app (ReadingsSheet) and goes back to the level. */

type Inst = DCLogic & Record<string, unknown> & { toast?: (t: string) => void; go?: (screen: string) => void };

export default function WorkshopApp({ qrSvg }: { qrSvg: string }) {
  const levelStart = useRef<(() => void) | null>(null);
  const [readings, setReadings] = useState(false);

  const setup = useCallback((raw: DCLogic & Record<string, unknown>) => {
    const inst = raw as Inst;
    const sync = () => {
      inst.setState({ instStandalone: isStandalone(), instOs: osOf(), instCan: canPrompt() });
    };
    inst.installPrompt = async () => {
      const r = await promptInstall();
      if (r === 'accepted') inst.toast?.('Installed. Open it from your home screen.');
      sync();
    };
    // the Spirit level tile opens the full level instead of the canvas's own screen
    const go = inst.go?.bind(inst);
    inst.go = (screen: string) => {
      if (screen === 'level' && levelStart.current) {
        levelStart.current();
        return;
      }
      go?.(screen);
    };
    inst.setState({ proLive: proOnSale() });
    sync();
    const off = onInstallChange(() => {
      sync();
      if (justInstalled()) inst.setState({ instCan: false });
    });
    keepOffline();
    return off;
  }, []);

  return (
    <>
      <DcRoot
        app={APP as unknown as DcApp}
        className="wt-host"
        // drawn before the page knows whether it was opened from the home screen, so the card waits
        initial={{ instStandalone: true }}
        setup={setup}
        fallback={
          <div className="wt-wait" aria-hidden="true">
            <span>Workshop Tools</span>
          </div>
        }
      />
      <SpiritLevel
        qrSvg={qrSvg}
        embed={{
          register: (start) => {
            levelStart.current = start;
          },
          onReadings: () => setReadings(true),
        }}
      />
      {readings ? (
        <ReadingsSheet
          onClose={() => setReadings(false)}
          onLevel={() => {
            setReadings(false);
            levelStart.current?.();
          }}
        />
      ) : null}
    </>
  );
}

/* Your readings from the level, over the app: the same list as /tools/readings (send on WhatsApp, copy, edit). */
function ReadingsSheet({ onClose, onLevel }: { onClose: () => void; onLevel: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      root.style.overflow = before;
    };
  }, [onClose]);
  return (
    <div className="wt-readings" role="dialog" aria-modal="true" aria-label="Your readings">
      <div className="mx-auto max-w-[720px] px-4 pt-[calc(10px+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-1.5 font-mono text-[13px] text-faint transition-colors hover:text-accent">
            <span aria-hidden="true">‹</span> Workshop Tools
          </button>
          <button type="button" onClick={onLevel} className="btn btn-ghost btn-sm">
            Spirit level
          </button>
        </div>
        <h1 className="mt-2 font-display text-[34px] font-[680] leading-none tracking-[-0.03em]">Your readings</h1>
        <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-muted">
          Every Save from the spirit level lands here, by place. They&apos;re kept on this phone only, until you send them on.
        </p>
        <ReadingsList onBack={onLevel} />
      </div>
    </div>
  );
}
