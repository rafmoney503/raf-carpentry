import Link from 'next/link';

export interface Tool {
  name: string;
  link: string;
}

export default function ToolsUsed({ tools }: { tools: Tool[] }) {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="mt-12 border border-[--border] rounded-2xl bg-[--bg-card] p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🛠️</span>
        <h3 className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>Tools Used in This Post</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {tools.map((tool, i) => (
          <a
            key={i}
            href={tool.link}
            target={tool.link.startsWith('http') ? '_blank' : undefined}
            rel={tool.link.startsWith('http') ? 'noopener sponsored' : undefined}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[--border] bg-[--bg] text-sm hover:border-[--gold] hover:text-[--gold] transition-colors"
          >
            {tool.name}
            {tool.link.startsWith('http') && <span className="text-[--text-muted] text-xs">↗</span>}
          </a>
        ))}
      </div>
      <p className="text-[10px] text-[--text-muted] mt-4">
        Affiliate links — I earn a small commission at no cost to you. <Link href="/tools" className="text-[--gold] hover:underline">See all my tools →</Link>
      </p>
    </div>
  );
}
