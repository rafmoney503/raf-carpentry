'use client';

export type ContactPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  email: string;
  phone: string;
  address: string;
  responseTimeLabel: string;
  responseTimeValue: string;
  formEnabled: boolean;
  formHeading: string;
  formSubmitLabel: string;
};

export default function ContactClient({ d }: { d: ContactPageData }) {
  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32">
        <div className={`grid grid-cols-1 gap-12 ${d.formEnabled ? 'md:grid-cols-2' : ''}`}>
          <div>
            <div className="gold-line mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {d.title}<br /><span className="gold-text">{d.titleAccent}</span>
            </h1>
            <p className="text-[--text-muted] leading-relaxed mb-8">
              {d.subtitle}
            </p>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">{'\u{1F4E7}'}</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Email</div>
                  <div className="text-sm font-medium">{d.email}</div>
                </div>
              </div>
                                        <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">{'\u{1F4F1}'}</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Phone / WhatsApp</div>
                  <div className="text-sm font-medium">{d.phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">{'\u{1F4CD}'}</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Based in</div>
                  <div className="text-sm font-medium">{d.address}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">{'\u23F1\uFE0F'}</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">{d.responseTimeLabel}</div>
                  <div className="text-sm font-medium">{d.responseTimeValue}</div>
                </div>
              </div>
            </div>
          </div>

          {d.formEnabled ? (
            <div className="bg-[--bg-card] border border-[--border] rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-6">{d.formHeading}</h3>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="text-xs text-[--text-muted] uppercase tracking-wider block mb-2">Name</label>
                  <input
                    type="text"
                    className="w-full bg-[--bg] border border-[--border] rounded-xl px-4 py-3 text-sm text-[--text] outline-none focus:border-[--gold] transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs text-[--text-muted] uppercase tracking-wider block mb-2">Email</label>
                  <input
                    type="email"
                    className="w-full bg-[--bg] border border-[--border] rounded-xl px-4 py-3 text-sm text-[--text] outline-none focus:border-[--gold] transition-colors"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-[--text-muted] uppercase tracking-wider block mb-2">Project Type</label>
                  <select className="w-full bg-[--bg] border border-[--border] rounded-xl px-4 py-3 text-sm text-[--text-muted] outline-none focus:border-[--gold] transition-colors">
                    <option>Kitchen / Cabinets</option>
                    <option>Custom Furniture</option>
                    <option>Outdoor Build</option>
                    <option>SketchUp Design</option>
                    <option>Cabinetos Inquiry</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[--text-muted] uppercase tracking-wider block mb-2">Message</label>
                  <textarea
                    rows={4}
                    className="w-full bg-[--bg] border border-[--border] rounded-xl px-4 py-3 text-sm text-[--text] outline-none focus:border-[--gold] transition-colors resize-none"
                    placeholder="Tell me about your project..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  {d.formSubmitLabel}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
