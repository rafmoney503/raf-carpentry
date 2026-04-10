import Link from 'next/link';
import type { Metadata } from 'next';
import { readPageJson } from '@/lib/pages';

type ToolEntry = {
  name: string;
  description: string;
  url: string;
  image: string;
  price: string;
};

type ToolsPageData = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  titleAccent: string;
  intro: string;
  disclosure: string;
  categories: {
    name: string;
    icon: string;
    tools: ToolEntry[];
  }[];
  footerCtaTitle: string;
  footerCtaTitleAccent: string;
  footerCtaSubtitle: string;
  footerCtaButtonLabel: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const d = readPageJson<ToolsPageData>('tools.json');
  return {
    title: d.metaTitle,
    description: d.metaDescription,
  };
}

export default function ToolsPage() {
  const d = readPageJson<ToolsPageData>('tools.json');

  return (
    <>
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-10 md:pt-32">
        <div className="gold-line mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {d.title}<span className="gold-text">{d.titleAccent}</span>
        </h1>
        <p className="text-lg text-[--text-muted] max-w-lg mb-4">
          {d.intro}
        </p>
        <p className="text-xs text-[--text-muted] bg-[--bg-card] border border-[--border] rounded-lg px-4 py-2.5 inline-block">
          {d.disclosure}
        </p>
      </section>

      {d.categories.map((cat, ci) => (
        <section key={ci} className="max-w-4xl mx-auto px-6 pb-14">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{cat.icon}</span>
            <h2 className="text-2xl font-bold">{cat.name}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cat.tools.map((tool, ti) => {
              const href = tool.url;
              const isExternal = href?.startsWith('http');
              return (
                <a
                  key={ti}
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener sponsored' : undefined}
                  className="card-hover bg-[--bg-card] border border-[--border] rounded-xl p-5 group block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold group-hover:text-[--gold] transition-colors">{tool.name}</h3>
                      <p className="text-sm text-[--text-muted] mt-1 leading-relaxed">{tool.description}</p>
                    </div>
                    <span className="text-xs text-[--gold] font-bold bg-[rgba(212,168,83,0.1)] px-2.5 py-1 rounded-md flex-shrink-0 mt-0.5">
                      {tool.price}
                    </span>
                  </div>
                  {isExternal && (
                    <div className="mt-3 text-xs text-[--gold] opacity-0 group-hover:opacity-100 transition-opacity">
                      View on Amazon →
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{d.footerCtaTitle}<span className="gold-text">{d.footerCtaTitleAccent}</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-6">{d.footerCtaSubtitle}</p>
          <Link href="/blog" className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
            {d.footerCtaButtonLabel}
          </Link>
        </div>
      </section>
    </>
  );
}
