import Link from 'next/link';

export default function SketchUpPage() {
  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32">
        <div className="max-w-3xl">
          <div className="gold-line mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Design It <span className="gold-text">Before You Build It</span>
          </h1>
          <p className="text-lg text-[--text-muted] max-w-xl leading-relaxed mb-10">
            Learn how I use SketchUp to plan every project, eliminate mistakes, and impress clients before a single cut is made.
          </p>
        </div>
      </section>

      {/* Why SketchUp */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-[--border] bg-[--bg-card] p-8">
            <h3 className="text-xl font-bold mb-4">Why I Use <span className="gold-text">SketchUp</span></h3>
            <p className="text-[--text-muted] leading-relaxed mb-4">
              When I started using SketchUp, it completely transformed my workflow. Clients could see exactly what they were getting before I ordered a single board. Mistakes dropped to almost zero. Material waste went down. And quoting became faster because I could measure everything digitally.
            </p>
            <p className="text-[--text-muted] leading-relaxed">
              Today, every project I take on starts in SketchUp. It&apos;s become as essential as my tape measure.
            </p>
          </div>
          <div className="rounded-2xl border border-[--border] bg-[--bg-card] flex items-center justify-center aspect-square md:aspect-auto">
            <div className="text-center">
              <span className="text-6xl block mb-3">✏️</span>
              <p className="text-[--text-muted] text-sm">SketchUp model gallery goes here</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Benefits for <span className="gold-text">Carpenters</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '👁️', title: 'Client Visualisation', desc: 'Show clients photorealistic renders. Get sign-off before you start — no surprises, no disputes.' },
            { icon: '📏', title: 'Precision Planning', desc: 'Every measurement is accurate. Export dimensions directly to your cut list or Cabinetos.' },
            { icon: '💰', title: 'Better Quotes', desc: 'Measure materials from the model, price accurately, and win more jobs with professional presentations.' },
          ].map((b, i) => (
            <div key={i} className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl p-7">
              <span className="text-3xl block mb-4">{b.icon}</span>
              <h3 className="font-bold text-lg mb-2">{b.title}</h3>
              <p className="text-sm text-[--text-muted] leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3D Gallery placeholder */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold mb-8">3D Designs <span className="gold-text">vs Real Builds</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2].map(i => (
            <div key={i} className="rounded-2xl border border-[--border] overflow-hidden bg-[--bg-card]">
              <div className="grid grid-cols-2">
                <div className="aspect-square bg-[--bg-card-hover] flex items-center justify-center border-r border-[--border]">
                  <div className="text-center"><span className="text-3xl opacity-20">✏️</span><p className="text-xs text-[--text-muted] mt-1">SketchUp</p></div>
                </div>
                <div className="aspect-square bg-[--bg-card-hover] flex items-center justify-center">
                  <div className="text-center"><span className="text-3xl opacity-20">📷</span><p className="text-xs text-[--text-muted] mt-1">Real build</p></div>
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-bold text-sm">Project {i} — SketchUp to reality</h4>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Want a 3D Design <span className="gold-text">For Your Project?</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-6">I can design your project in SketchUp so you see exactly what you&apos;re getting before we start.</p>
          <Link href="/contact" className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
