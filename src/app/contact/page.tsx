'use client';

export default function Contact() {
  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <div className="gold-line mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Let&apos;s Talk About<br /><span className="gold-text">Your Project</span>
            </h1>
            <p className="text-[--text-muted] leading-relaxed mb-8">
              Whether it&apos;s a kitchen remodel, a custom build, or a question about Cabinetos — I&apos;d love to hear from you.
            </p>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">📧</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Email</div>
                  <div className="text-sm font-medium">hello@rafcarpentry.com</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">📱</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Phone / WhatsApp</div>
                  <div className="text-sm font-medium">Available on request</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">📍</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Based in</div>
                  <div className="text-sm font-medium">London, UK</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(212,168,83,0.1)] flex items-center justify-center text-lg">⏱️</div>
                <div>
                  <div className="text-xs text-[--text-muted] uppercase tracking-wider">Response Time</div>
                  <div className="text-sm font-medium">I reply within 24 hours</div>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-[--bg-card] border border-[--border] rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6">Send a Message</h3>
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
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
