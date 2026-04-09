import Link from 'next/link';
import Image from 'next/image';

const services = [
  {
    icon: '🪚',
    title: 'Bespoke Carpentry',
    desc: 'Custom kitchens, cabinets, outdoor structures, and precision woodwork tailored to your vision.',
    href: '/portfolio',
    color: 'rgba(74,222,128,0.12)',
  },
  {
    icon: '📱',
    title: 'Cabinetos App',
    desc: 'Automatic parts lists, cut lists, board optimisation, and print-ready outputs for cabinet makers.',
    href: '/cabinetos',
    color: 'rgba(96,165,250,0.12)',
  },
  {
    icon: '✏️',
    title: 'SketchUp Expertise',
    desc: 'Digital design for carpenters — plan every project in 3D before making a single cut.',
    href: '/sketchup',
    color: 'rgba(167,139,250,0.12)',
  },
];

const projects = [
  { title: 'Bespoke Kitchen Pantry', category: 'Kitchens', img: '/images/projects/IMG_8984.jpg', hasPhoto: true },
  { title: 'Garden Office Units', category: 'Outdoor', img: '/images/projects/IMG_9245.jpg', hasPhoto: true },
  { title: 'Built-in Wardrobes', category: 'Cabinets', img: '/images/projects/IMG_8172.jpg', hasPhoto: true },
  { title: 'Birch Ply Wardrobe', category: 'Custom', img: '/images/projects/IMG_8405.jpg', hasPhoto: true },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(212,168,83,0.06)] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,168,83,0.08)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="gold-line mb-6 animate-fade-in-up" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] mb-6 animate-fade-in-up delay-1">
                Craftsmanship<br />
                <span className="gold-text">Meets Technology</span>
              </h1>
              <p className="text-lg md:text-xl text-[--text-muted] max-w-xl mb-10 leading-relaxed animate-fade-in-up delay-2">
                Bespoke carpentry, smart tools for cabinet makers, and decades of hands-on expertise — all under one roof.
              </p>
              <div className="flex flex-wrap gap-4 animate-fade-in-up delay-3">
                <Link
                  href="/portfolio"
                  className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  View My Work
                </Link>
                <Link
                  href="/cabinetos"
                  className="px-7 py-3.5 rounded-xl border border-[--border] text-[--text] font-bold text-sm hover:border-[--gold] hover:text-[--gold] transition-colors"
                >
                  Try Cabinetos
                </Link>
              </div>
            </div>
            <div className="hidden md:block relative animate-fade-in-up delay-3">
              <div className="rounded-2xl overflow-hidden border border-[--border] aspect-[3/4] relative">
                <Image src="/images/raf-at-work.jpg" alt="Rafal measuring timber on site" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[--bg] via-transparent to-transparent opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">What I <span className="gold-text">Offer</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto">From hand-crafted builds to digital tools that make carpenters more efficient.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <Link
              key={i}
              href={s.href}
              className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl p-8 group"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-5"
                style={{ background: s.color }}
              >
                {s.icon}
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-[--gold] transition-colors">{s.title}</h3>
              <p className="text-sm text-[--text-muted] leading-relaxed">{s.desc}</p>
              <div className="mt-5 text-sm text-[--gold] opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Projects */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Featured <span className="gold-text">Projects</span></h2>
            <p className="text-[--text-muted]">A selection of recent work — precision, purpose, and craftsmanship.</p>
          </div>
          <Link href="/portfolio" className="hidden md:block text-sm text-[--gold] hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {projects.map((p, i) => (
            <div key={i} className="card-hover group rounded-2xl overflow-hidden border border-[--border] bg-[--bg-card]">
              <div className="aspect-[4/3] bg-[--bg-card-hover] flex items-center justify-center text-[--text-muted] text-sm relative overflow-hidden">
                {p.hasPhoto ? (
                  <Image src={p.img} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <span className="text-4xl opacity-20">📷</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[--bg-card] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
              </div>
              <div className="p-4">
                <span className="text-xs text-[--gold] font-medium uppercase tracking-wider">{p.category}</span>
                <h4 className="font-bold mt-1 text-sm">{p.title}</h4>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center md:hidden">
          <Link href="/portfolio" className="text-sm text-[--gold]">View all projects →</Link>
        </div>
      </section>

      {/* Cabinetos CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-[--border] bg-gradient-to-br from-[--bg-card] to-[rgba(212,168,83,0.03)] p-8 md:p-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(212,168,83,0.08)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[--gold] mb-4 block">New App</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Stop Wasting Material.<br />
              <span className="gold-text">Start Cutting Smarter.</span>
            </h2>
            <p className="text-[--text-muted] mb-8 max-w-lg leading-relaxed">
              Cabinetos automates your parts list, cut list, board optimisation and printing — so you can focus on building, not calculating.
            </p>
            <Link
              href="/cabinetos"
              className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Learn More About Cabinetos
            </Link>
          </div>
        </div>
      </section>

      {/* Blog Preview */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">The Workshop <span className="gold-text">Journal</span></h2>
            <p className="text-[--text-muted]">Tips, tutorials, and behind-the-scenes from a carpenter who codes.</p>
          </div>
          <Link href="/blog" className="hidden md:block text-sm text-[--gold] hover:underline">
            Read all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'How I Use SketchUp to Plan Every Build', tag: 'SketchUp', date: '9 Apr 2026', img: '/images/blog/sketchup-planning.jpg', slug: '/blog/sketchup-planning' },
            { title: 'Cut List Optimisation: Save 15% on Materials', tag: 'Cabinetos', date: '5 Apr 2026', img: '', slug: '/blog/cut-list-optimisation' },
            { title: 'Building an Outdoor Gym During Lockdown', tag: 'Projects', date: '20 Mar 2026', img: '', slug: '/blog/outdoor-gym-lockdown' },
          ].map((post, i) => (
            <Link key={i} href={post.slug} className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl overflow-hidden group">
              <div className="aspect-video bg-[--bg-card-hover] flex items-center justify-center relative overflow-hidden">
                {post.img ? (
                  <Image src={post.img} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <span className="text-3xl opacity-20">📝</span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[--gold]">{post.tag}</span>
                  <span className="text-xs text-[--text-muted]">· {post.date}</span>
                </div>
                <h4 className="font-bold group-hover:text-[--gold] transition-colors">{post.title}</h4>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center py-16 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Got a Project <span className="gold-text">in Mind?</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-8">
            Whether it&apos;s a kitchen remodel, a custom build, or a question about Cabinetos — I&apos;d love to hear from you.
          </p>
          <Link
            href="/contact"
            className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
