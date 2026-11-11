import { AlertsClient } from '@/components/alerts';
import { morningNotes } from '@/lib/morning';
import { pushReady } from '@/lib/push';
import { getReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const r = await getReport();
  const preview = morningNotes(r, Date.now() - 24 * 3600 * 1000);
  return (
    <>
      <div className="hello">
        <p>Every morning at 7:43</p>
        <h1>Alerts</h1>
        <p className="lead">One summary on your phone each morning: yesterday&apos;s visitors and anything new worth knowing. Nothing else.</p>
      </div>
      <AlertsClient vapid={process.env.HQ_VAPID_PUBLIC ?? ''} ready={pushReady()} preview={preview} />
    </>
  );
}
