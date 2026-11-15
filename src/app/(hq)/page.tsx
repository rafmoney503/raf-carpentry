import { Today } from '@/components/today';
import { getReport } from '@/lib/report';
import { agentList } from '@/lib/agents';
import { dbReady } from '@/lib/db';
import { linkedinList } from '@/lib/linkedin';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  const { fresh } = await searchParams;
  const [r, agents, linkedin] = await Promise.all([
    getReport(fresh === '1'),
    dbReady() ? agentList() : Promise.resolve(null),
    dbReady() ? linkedinList() : Promise.resolve(null),
  ]);
  return <Today r={r} now={r.at} agents={agents} linkedin={linkedin} />;
}
