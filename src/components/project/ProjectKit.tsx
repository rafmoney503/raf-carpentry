import { SectionHeading } from '@/components/ui';
import type { Kit, KitItem } from '@/lib/projects';

/* "What I used" on a job page: materials and tools, from the Project kit tab of Raf's sheet.
   A tool shows a "View on Amazon" link only once Raf has confirmed the exact product. */
export default function ProjectKit({ kit }: { kit: Kit }) {
  const hasLinks = kit.tools.some((t) => t.link);
  const groups: [string, KitItem[]][] = [
    ['Materials', kit.materials],
    ['Tools', kit.tools],
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-12 md:gap-6">
      <div className="md:sticky md:top-28 md:col-span-4">
        <SectionHeading>What I used</SectionHeading>
        <p className="mt-4 max-w-[40ch] text-muted">The materials and tools that went into this job.</p>
      </div>
      <div className="md:col-span-7 md:col-start-6">
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
          {groups
            .filter(([, items]) => items.length > 0)
            .map(([label, items]) => (
              <div key={label}>
                <h3 className="kicker">{label}</h3>
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {items.map((it) => {
                    const detail = [it.brand, it.model].filter(Boolean).join(' ');
                    return (
                      <li key={`${it.name}-${detail}`} className="flex items-baseline justify-between gap-4 py-3">
                        <span>
                          <span className="block text-[16px] leading-snug text-ink">{it.name}</span>
                          {detail ? <span className="mt-0.5 block font-mono text-[12.5px] text-faint">{detail}</span> : null}
                        </span>
                        {it.link ? (
                          <a
                            href={it.link}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className="shrink-0 font-mono text-[12.5px] font-medium text-accent hover:underline"
                          >
                            View on Amazon <span aria-hidden="true">↗</span>
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
        {hasLinks ? (
          <p className="mt-6 font-mono text-[12.5px] text-faint">As an Amazon Associate I earn from qualifying purchases.</p>
        ) : null}
      </div>
    </div>
  );
}
