import { Sidebar, Tabs, type SideSite } from '@/components/nav';
import { getReport } from '@/lib/report';
import { agentNeedCount } from '@/lib/agents';
import { dbReady } from '@/lib/db';
import { SITES } from '@/lib/sites';

export const dynamic = 'force-dynamic';

export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const [r, needs] = await Promise.all([getReport().catch(() => null), dbReady() ? agentNeedCount().catch(() => 0) : Promise.resolve(0)]);
  const sites: SideSite[] = SITES.map((s) => {
    const st = r?.sites.find((x) => x.key === s.key);
    const down = st?.up && !st.up.ok;
    const state = down ? 'Down' : st?.status === 'not-counting' ? 'Not counted' : st?.status === 'ok' ? 'Up' : st?.up?.ok ? 'Up' : '';
    return { key: s.key, name: s.name, color: s.color, light: s.light, ink: s.ink, state, good: !down && state === 'Up' };
  });
  return (
    <div className="hq">
      <Sidebar sites={sites} unread={r?.messages?.unread ?? 0} needs={needs} />
      <main className="hq-main">{children}</main>
      <Tabs unread={r?.messages?.unread ?? 0} needs={needs} />
    </div>
  );
}
