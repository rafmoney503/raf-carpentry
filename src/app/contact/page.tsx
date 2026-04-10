import { supabase } from "@/lib/supabase";

const defaultContent = {
  title: "Get in",
  titleHighlight: "Touch",
  subtitle: "Ready to start your project? Let's discuss your vision and bring it to life.",
  email: "raf@rafcarpentry.com",
  phone: "07XXX XXXXXX",
  location: "London, UK",
};

async function getContent() {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("content")
      .eq("id", "contact")
      .single();

    if (error || !data) {
      return defaultContent;
    }

    return data.content as typeof defaultContent;
  } catch {
    return defaultContent;
  }
}

export const revalidate = 60;

export default async function ContactPage() {
  const content = await getContent();

  return (
    <main className="min-h-screen bg-[#0f1114]">
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-serif text-white mb-6">
              {content.title}{" "}
              <span className="text-[#d4a853]">{content.titleHighlight}</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {content.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <h2 className="text-2xl font-serif text-white mb-6">
                Contact <span className="text-[#d4a853]">Details</span>
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-xl">
                    📧
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Email</div>
                    <a href={`mailto:${content.email}`} className="text-white hover:text-[#d4a853] transition">
                      {content.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-xl">
                    📱
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Phone</div>
                    <a href={`tel:${content.phone}`} className="text-white hover:text-[#d4a853] transition">
                      {content.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-xl">
                    📍
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Location</div>
                    <span className="text-white">{content.location}</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-zinc-800">
                <h3 className="text-lg font-serif text-white mb-4">Follow Me</h3>
                <div className="flex gap-4">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#d4a853] hover:bg-zinc-800 transition"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
              <h2 className="text-2xl font-serif text-white mb-6">
                Send a <span className="text-[#d4a853]">Message</span>
              </h2>
              
              <form className="space-y-6">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Your Name</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#d4a853] focus:outline-none transition"
                    placeholder="John Smith"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Email Address</label>
                  <input
                    type="email"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#d4a853] focus:outline-none transition"
                    placeholder="john@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Project Type</label>
                  <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#d4a853] focus:outline-none transition">
                    <option>Kitchen</option>
                    <option>Fitted Wardrobes</option>
                    <option>Garden Structure</option>
                    <option>Shelving & Storage</option>
                    <option>Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Your Message</label>
                  <textarea
                    rows={4}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#d4a853] focus:outline-none transition resize-none"
                    placeholder="Tell me about your project..."
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full py-4 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
