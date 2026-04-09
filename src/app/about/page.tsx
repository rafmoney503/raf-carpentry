import Link from 'next/link';

export default function About() {
  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="gold-line mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              A Carpenter Who<br /><span className="gold-text">Thinks in Code</span>
            </h1>
            <p className="text-[--text-muted] leading-relaxed mb-4">
              From building outdoor gyms during lockdown to creating apps that help carpenters work smarter — my journey has always been about combining hands-on craft with digital innovation.
            </p>
            <p className="text-[--text-muted] leading-relaxed mb-4">
              I&apos;ve spent years honing my carpentry skills across kitchens, bespoke furniture, and structural builds. Along the way, I discovered SketchUp and it transformed how I plan and present work to clients.
            </p>
            <p className="text-[--text-muted] leading-relaxed">
              That same drive to work smarter led me to build <strong className="text-[--text]">Cabinetos</strong> — an app that automates the tedious calculations every cabinet maker deals with daily. Parts lists, cut lists, board optimisation — done in seconds instead of hours.
            </p>
          </div>
          <div className="aspect-square rounded-2xl border border-[--border] bg-[--bg-card] flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl block mb-3">👤</span>
              <p className="text-[--text-muted] text-sm">Your photo goes here</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { num: '10+', label: 'Years Experience' },
            { num: '100+', label: 'Projects Completed' },
            { num: '1', label: 'App Built' },
            { num: '∞', label: 'Passion for Craft' },
          ].map((s, i) => (
            <div key={i} className="text-center py-8 rounded-2xl border border-[--border] bg-[--bg-card]">
              <div className="text-3xl font-bold gold-text mb-1">{s.num}</div>
              <div className="text-xs text-[--text-muted] uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What makes me different */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">What Makes Me <span className="gold-text">Different</span></h2>
        <div className="space-y-4">
          {[
            { title: 'I design before I build', desc: 'Every project starts in SketchUp. You see a 3D model before I pick up a saw.' },
            { title: 'I build tools for builders', desc: 'Cabinetos was born from my own frustrations with manual calculations. It solves real problems.' },
            { title: 'I share what I learn', desc: 'Through my blog, social media, and tutorials — I help other carpenters level up their workflow.' },
          ].map((item, i) => (
            <div key={i} className="bg-[--bg-card] border border-[--border] rounded-xl p-6 flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-[rgba(212,168,83,0.15)] flex items-center justify-center text-[--gold] text-sm font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <h4 className="font-bold mb-1">{item.title}</h4>
                <p className="text-sm text-[--text-muted]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Socials */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl font-bold mb-6">Follow <span className="gold-text">My Journey</span></h2>
          <div className="flex justify-center gap-4 flex-wrap">
            {[
              { label: 'Instagram', href: 'https://www.instagram.com/raf_carpentry/' },
              { label: 'TikTok', href: 'https://www.tiktok.com/@rafcarpentry' },
              { label: 'Facebook', href: 'https://www.facebook.com/rafcarpentry/' },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener" className="px-6 py-3 rounded-xl border border-[--border] text-sm hover:border-[--gold] hover:text-[--gold] transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
