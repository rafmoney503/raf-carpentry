import Link from 'next/link';

const features = [
  { icon: '📋', title: 'Parts List', desc: 'Automatically generate complete parts lists from your cabinet designs. No more manual counting.' },
  { icon: '✂️', title: 'Cut List', desc: 'Optimised cut lists that tell you exactly what to cut, in what order, from which board.' },
  { icon: '📐', title: 'Board Optimisation', desc: 'Intelligent nesting algorithms that minimise waste and save you up to 15% on materials.' },
  { icon: '🖨️', title: 'Print Ready', desc: 'Export professional cut sheets and labels ready for the workshop floor.' },
];

const faqs = [
  { q: 'Who is Cabinetos for?', a: 'Cabinet makers, carpenters, kitchen fitters, and anyone who builds furniture from sheet materials.' },
  { q: 'Does it work with any board size?', a: 'Yes — you can set custom board dimensions, thickness, and even grain direction preferences.' },
  { q: 'Can I save and reuse projects?', a: 'Absolutely. Save templates for common cabinet types and reuse them across projects.' },
  { q: 'What makes it different from other cut list tools?', a: 'Cabinetos is built by a working carpenter who understands the real workshop workflow — it\'s practical, not theoretical.' },
];

export default function Cabinetos() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(96,165,250,0.05)] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 block">Cabinet Making App</span>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] mb-6">
              Stop Wasting Material.<br />
              <span className="gold-text">Start Cutting Smarter.</span>
            </h1>
            <p className="text-lg text-[--text-muted] max-w-xl mb-10 leading-relaxed">
              Cabinetos automates your parts list, cut list, board optimisation and printing — so you can focus on building, not calculating.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#features" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
                See Features
              </a>
              <a href="#faq" className="px-7 py-3.5 rounded-xl border border-[--border] text-[--text] font-bold text-sm hover:border-[--gold] hover:text-[--gold] transition-colors">
                FAQs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* App mockup placeholder */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="aspect-video rounded-2xl border border-[--border] bg-[--bg-card] flex items-center justify-center">
          <div className="text-center">
            <span className="text-6xl block mb-4">📱</span>
            <p className="text-[--text-muted] text-sm">App screenshot / demo video goes here</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">How Cabinetos <span className="gold-text">Works</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto">Four steps from design to workshop-ready cut sheets.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl p-8">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-xl bg-[rgba(96,165,250,0.12)] flex items-center justify-center text-2xl flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-[--text-muted] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Before/After */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-red-900/30 bg-[rgba(239,68,68,0.03)] p-8">
            <h3 className="text-xl font-bold mb-4 text-red-400">Without Cabinetos</h3>
            <ul className="space-y-3 text-sm text-[--text-muted]">
              <li className="flex gap-2"><span className="text-red-400">✗</span> Hours of manual calculations</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Material waste from poor nesting</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Errors in part dimensions</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Handwritten cut sheets</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-green-900/30 bg-[rgba(74,222,128,0.03)] p-8">
            <h3 className="text-xl font-bold mb-4 text-green-400">With Cabinetos</h3>
            <ul className="space-y-3 text-sm text-[--text-muted]">
              <li className="flex gap-2"><span className="text-green-400">✓</span> Instant parts and cut lists</li>
              <li className="flex gap-2"><span className="text-green-400">✓</span> Up to 15% less material waste</li>
              <li className="flex gap-2"><span className="text-green-400">✓</span> Zero calculation errors</li>
              <li className="flex gap-2"><span className="text-green-400">✓</span> Professional print-ready outputs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold mb-10 text-center">Frequently <span className="gold-text">Asked</span></h2>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className="bg-[--bg-card] border border-[--border] rounded-xl p-6">
              <h4 className="font-bold mb-2">{f.q}</h4>
              <p className="text-sm text-[--text-muted] leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to <span className="gold-text">Cut Smarter?</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-6">Join carpenters who are saving time and materials with Cabinetos.</p>
          <Link href="/contact" className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
            Get Early Access
          </Link>
        </div>
      </section>
    </>
  );
}
