import Link from 'next/link';

export interface Tool {
  name: string;
  link?: string;
  url?: string;
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
        {tools.map((tool, i) => {
          const href = tool.link || tool.url;
          const isExternal = href?.startsWith('http');
          return (
            <a
              key={i}
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener sponsored' : undefined}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[--border] bg-[--bg] text-sm hover:border-[--gold] hover:text-[--gold] transition-colors"
            >
              {tool.name}
              {isExternal && <span className="text-[--text-muted] text-xs">{'\u2197'}</span>}
            </a>
          );
        })}
      </div>
      <p className="text-[10px] text-[--text-muted] mt-4">
        Affiliate links — I earn a small commission at no cost to you. <Link href="/tools" className="text-[--gold] hover:underline">See all my tools →</Link>
      </p>
    </div>
  );
}
