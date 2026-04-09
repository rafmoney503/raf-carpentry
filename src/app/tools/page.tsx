import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Carpentry Tools — Raf Carpentry',
  description: 'The tools I use daily for carpentry, cabinet making, and woodworking. Honest recommendations from a working carpenter.',
};

const categories = [
  {
    name: 'Power Tools',
    icon: '⚡',
    tools: [
      { name: 'Makita Track Saw', desc: 'My go-to for clean, straight cuts on sheet materials. Essential for cabinet work.', link: '#', price: '£££' },
      { name: 'Festool Domino Joiner', desc: 'Game-changer for strong, fast joinery. Worth every penny.', link: '#', price: '££££' },
      { name: 'Makita Cordless Drill', desc: 'Reliable everyday driver. I own three of these.', link: '#', price: '££' },
      { name: 'Makita Cordless Jigsaw', desc: 'For curved cuts and quick scribing on site.', link: '#', price: '££' },
    ],
  },
  {
    name: 'Hand Tools',
    icon: '🪚',
    tools: [
      { name: 'Stanley FatMax Tape Measure 5m', desc: 'The yellow tape you see in every photo. Accurate and durable.', link: '#', price: '£' },
      { name: 'Irwin Marples Chisels', desc: 'Great edge retention, comfortable grip. Use them daily.', link: '#', price: '££' },
      { name: 'Bahco Hand Saw', desc: 'For quick cuts where setting up a power tool isn\'t worth it.', link: '#', price: '£' },
      { name: 'Stabila Spirit Level', desc: 'Accurate and built to survive a building site.', link: '#', price: '££' },
    ],
  },
  {
    name: 'Measuring & Layout',
    icon: '📏',
    tools: [
      { name: 'Bosch Laser Measure', desc: 'Instant room measurements. Saves hours on site surveys.', link: '#', price: '££' },
      { name: 'Shinwa Combination Square', desc: 'Precision marking for joinery and cabinet work.', link: '#', price: '£' },
      { name: 'Incra T-Rule', desc: 'Dead accurate for marking out cuts on boards.', link: '#', price: '£' },
    ],
  },
  {
    name: 'Software & Digital',
    icon: '💻',
    tools: [
      { name: 'SketchUp Pro', desc: 'I design every project in 3D before building. Non-negotiable.', link: '#', price: '£££' },
      { name: 'Cabinetos', desc: 'My own app — automatic cut lists, parts lists, and board optimisation.', link: '/cabinetos', price: 'Free' },
    ],
  },
];

export default function ToolsPage() {
  return (
    <>
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-10 md:pt-32">
        <div className="gold-line mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          My Carpentry <span className="gold-text">Tools</span>
        </h1>
        <p className="text-lg text-[--text-muted] max-w-lg mb-4">
          Every tool here is something I personally use and recommend. No fluff — just the gear that makes my work better.
        </p>
        <p className="text-xs text-[--text-muted] bg-[--bg-card] border border-[--border] rounded-lg px-4 py-2.5 inline-block">
          🔗 Some links are affiliate links. I earn a small commission if you buy through them — at no extra cost to you. This helps support my content.
        </p>
      </section>

      {categories.map((cat, ci) => (
        <section key={ci} className="max-w-4xl mx-auto px-6 pb-14">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{cat.icon}</span>
            <h2 className="text-2xl font-bold">{cat.name}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cat.tools.map((tool, ti) => (
              <a
                key={ti}
                href={tool.link}
                target={tool.link.startsWith('http') ? '_blank' : undefined}
                rel={tool.link.startsWith('http') ? 'noopener sponsored' : undefined}
                className="card-hover bg-[--bg-card] border border-[--border] rounded-xl p-5 group block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold group-hover:text-[--gold] transition-colors">{tool.name}</h3>
                    <p className="text-sm text-[--text-muted] mt-1 leading-relaxed">{tool.desc}</p>
                  </div>
                  <span className="text-xs text-[--gold] font-bold bg-[rgba(212,168,83,0.1)] px-2.5 py-1 rounded-md flex-shrink-0 mt-0.5">
                    {tool.price}
                  </span>
                </div>
                {tool.link.startsWith('http') && (
                  <div className="mt-3 text-xs text-[--gold] opacity-0 group-hover:opacity-100 transition-opacity">
                    View on Amazon →
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      ))}

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Need Help <span className="gold-text">Choosing Tools?</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-6">I write about tools and techniques on my blog. Check it out for honest reviews and tips.</p>
          <Link href="/blog" className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
            Read the Blog
          </Link>
        </div>
      </section>
    </>
  );
}
