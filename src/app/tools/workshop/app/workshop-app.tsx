'use client';
import { useCallback } from 'react';
import * as APP from '@/lib/workshop-tools/app.generated';
import { DcRoot, type DCLogic, type DcApp } from '@/lib/workshop-tools/dc-runtime';
import { canPrompt, isStandalone, justInstalled, keepOffline, onInstallChange, osOf, promptInstall, proOnSale } from '@/lib/workshop-tools/install';
import './workshop-app.css';

/* The Workshop Tools app, full screen (no menu, footer or floating buttons: LayoutShell). The app is the one
   designed on the canvas; this hands it what only the page knows: how this phone adds apps to its home screen
   (the 'Keep it on your phone' card on its home), whether Pro is on sale yet, and the offline copy. */

type Inst = DCLogic & Record<string, unknown> & { toast?: (t: string) => void };

export default function WorkshopApp() {
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
  );
}
