import { Today } from '@/components/today';
import { getReport } from '@/lib/report';
import { agentList } from '@/lib/agents';
import { dbReady } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  const { fresh } = await searchParams;
  const [r, agents] = await Promise.all([getReport(fresh === '1'), dbReady() ? agentList() : Promise.resolve(null)]);
  return <Today r={r} now={r.at} agents={agents} />;
}
