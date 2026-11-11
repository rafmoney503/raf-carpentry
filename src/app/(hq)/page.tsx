import { Today } from '@/components/today';
import { getReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  const { fresh } = await searchParams;
  const r = await getReport(fresh === '1');
  return <Today r={r} now={r.at} />;
}
