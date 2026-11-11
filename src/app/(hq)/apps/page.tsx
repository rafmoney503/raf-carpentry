import { AppCard, OffCard } from '@/components/apps';
import { Health } from '@/components/health';
import { getReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

export default async function AppsPage() {
  const r = await getReport();
  const counted = r.sites.filter((s) => s.status === 'ok');
  const off = r.sites.filter((s) => s.status !== 'ok');
  return (
    <>
      <div className="hello">
        <p>{r.sites.length} sites and apps</p>
        <h1>Your apps</h1>
        <p className="lead">Visitors in the 7 days to yesterday. Tap one for where they came from and what they opened.</p>
      </div>
      <div className="apps-grid">
        {counted.map((s) => (
          <AppCard key={s.key} s={s} r={r} range="week" />
        ))}
      </div>
      {off.length ? <OffCard sites={off} /> : null}
      <Health r={r} />
    </>
  );
}
