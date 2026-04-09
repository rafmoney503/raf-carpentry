import Link from 'next/link';

const categories = ['All', 'Kitchens', 'Cabinets', 'Outdoor', 'Custom'];

const projects = [
  { title: 'Modern Kitchen Remodel', category: 'Kitchens', desc: 'Full kitchen design and build with bespoke oak cabinets and quartz worktops.' },
  { title: 'Outdoor Gym Structure', category: 'Outdoor', desc: 'Built during lockdown — a full timber frame outdoor gym with corner bracing for stability.' },
  { title: 'Built-in Wardrobes', category: 'Cabinets', desc: 'Floor to ceiling fitted wardrobes with soft-close hinges and internal organisers.' },
  { title: 'Bespoke Shelving Unit', category: 'Custom', desc: 'Floating shelves with hidden brackets, designed in SketchUp and precision-cut.' },
  { title: 'Kitchen Island', category: 'Kitchens', desc: 'Freestanding kitchen island with integrated storage and breakfast bar.' },
  { title: 'Garden Office', category: 'Outdoor', desc: 'Insulated timber-frame garden office with full electrics and custom desk.' },
];

export default function Portfolio() {
  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-10">
        <div className="gold-line mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Built With <span className="gold-text">Precision</span>
        </h1>
        <p className="text-[--text-muted] max-w-lg text-lg">
          From kitchens to outdoor structures — browse projects that show the standard of work you'll get.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-6">
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              className="px-4 py-2 rounded-full text-sm border border-[--border] text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors first:bg-[rgba(212,168,83,0.1)] first:text-[--gold] first:border-[--gold]"
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p, i) => (
            <div key={i} className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl overflow-hidden group">
              <div className="aspect-[4/3] bg-[--bg-card-hover] flex items-center justify-center relative">
                <span className="text-5xl opacity-15">📷</span>
                <div className="absolute bottom-3 left-3">
                  <span className="text-xs font-bold uppercase tracking-wider bg-[rgba(212,168,83,0.9)] text-[--bg] px-2.5 py-1 rounded-md">{p.category}</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2 group-hover:text-[--gold] transition-colors">{p.title}</h3>
                <p className="text-sm text-[--text-muted] leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Let&apos;s Build <span className="gold-text">Something Together</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-6">Have a project in mind? I&apos;d love to discuss it.</p>
          <Link href="/contact" className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
            Get a Quote
          </Link>
        </div>
      </section>
    </>
  );
}
