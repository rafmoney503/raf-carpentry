import { AgentsScreen } from '@/components/agents';
import { agentList } from '@/lib/agents';

export const dynamic = 'force-dynamic';

/* The Agents tab: one card for each agent, and Give a job. Read from Supabase each time. */
export default async function AgentsPage() {
  return <AgentsScreen list={await agentList()} />;
}
