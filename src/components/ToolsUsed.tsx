import Link from 'next/link';
import { isAmazonLink } from '@/lib/affiliates';

export interface Tool {
  name: string;
  link?: string;
  url?: string;
}

const chip = 'inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-mount px-3.5 text-sm text-ink';

export default function ToolsUsed({ tools }: { tools: Tool[] }) {
  if (!tools || tools.length === 0) return null;
  const hrefOf = (t: Tool) => {
    const h = t.link || t.url || '';
    return h && h !== '#' ? h : '';
  };
  const hasAmazon = tools.some((t) => isAmazonLink(hrefOf(t)));

  return (
    <aside className="mt-14 rounded-sm border border-line-strong bg-raised p-6 md:p-7">
      <h3 className="text-[21px] font-[620]">Tools used in this post</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {tools.map((tool, i) => {
          const href = hrefOf(tool);
          // Tools without a confirmed link are shown as plain labels.
          if (!href) return <span key={i} className={chip}>{tool.name}</span>;
          const isExternal = href.startsWith('http');
          // Only shop links are paid links; Raf's own sites (like CabinetOS) are not.
          const isShop = isAmazonLink(href);
          return (
            <a
              key={i}
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? (isShop ? 'sponsored nofollow noopener' : 'noopener') : undefined}
              className={`${chip} transition-colors hover:border-accent hover:text-accent`}
            >
              {tool.name}
              {isExternal && <span aria-hidden="true" className="text-xs text-faint">{'↗'}</span>}
            </a>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] text-faint">
        {hasAmazon ? 'Some are affiliate links: I earn a small commission at no cost to you. As an Amazon Associate I earn from qualifying purchases. ' : ''}
        <Link href="/tools" className="font-medium text-accent hover:underline">See all my tools</Link>
      </p>
    </aside>
  );
}
