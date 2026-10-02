import Link from 'next/link';

export interface Tool {
  name: string;
  link?: string;
  url?: string;
}

export default function ToolsUsed({ tools }: { tools: Tool[] }) {
  if (!tools || tools.length === 0) return null;

  return (
    <aside className="mt-14 rounded-sm border border-line-strong bg-raised p-6 md:p-7">
      <h3 className="text-[21px] font-[620]">Tools used in this post</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {tools.map((tool, i) => {
          const href = tool.link || tool.url;
          const isExternal = href?.startsWith('http');
          // Only shop links are paid links; Raf's own sites (like CabinetOS) are not.
          const isShop = Boolean(href && /amazon\.|amzn\./.test(href));
          return (
            <a
              key={i}
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? (isShop ? 'noopener sponsored' : 'noopener') : undefined}
              className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-mount px-3.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {tool.name}
              {isExternal && <span aria-hidden="true" className="text-xs text-faint">{'↗'}</span>}
            </a>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] text-faint">
        Some are affiliate links: I earn a small commission at no cost to you.{' '}
        <Link href="/tools" className="font-medium text-accent hover:underline">See all my tools</Link>
      </p>
    </aside>
  );
}
