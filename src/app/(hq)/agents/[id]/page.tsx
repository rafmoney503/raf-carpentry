import { AgentScreen } from '@/components/agents';
import { agentList } from '@/lib/agents';

export const dynamic = 'force-dynamic';

/* One agent: its report, what needs Rafal, a job to give it, its jobs, what it remembers and what it may do. */
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentScreen list={await agentList()} id={id} />;
}
