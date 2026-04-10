import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Default content if database is empty
const defaultContent = {
  hero: {
    badge: "BESPOKE CARPENTRY",
    title: "Crafting Spaces That",
    titleHighlight: "Tell Your Story",
    subtitle: "Expert carpentry and joinery services in London. From custom kitchens to fitted wardrobes, bringing your vision to life with precision and care.",
  },
  services: [
    { icon: "🪚", title: "Bespoke Kitchens", description: "Custom-designed kitchens tailored to your space and lifestyle" },
    { icon: "🚪", title: "Fitted Wardrobes", description: "Maximise storage with beautifully crafted built-in solutions" },
    { icon: "🏡", title: "Garden Structures", description: "Decking, pergolas, and outdoor living spaces" },
    { icon: "📐", title: "SketchUp Design", description: "See your project in 3D before we build" },
  ],
  cta: {
    title: "Ready to Start",
    titleHighlight: "Your Project?",
    subtitle: "Let's discuss your vision and bring it to life.",
    buttonText: "Get in Touch",
  },
};

async function getContent() {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("content")
      .eq("id", "homepage")
      .single();

    if (error || !data) {
      return defaultContent;
    }

    return data.content as typeof defaultContent;
  } catch {
    return defaultContent;
  }
}

export const revalidate = 60; // Revalidate every 60 seconds

export default async function HomePage() {
  const content = await getContent();

  return (
    <main className="min-h-screen bg-[#0f1114]">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1114] via-transparent to-[#0f1114]" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-2 text-xs tracking-[0.3em] text-[#d4a853] border border-[#d4a853]/30 rounded-full mb-8 uppercase">
            {content.hero.badge}
          </span>
          
          <h1 className="text-5xl md:text-7xl font-serif text-white leading-tight mb-6">
            {content.hero.title}
            <span className="block text-[#d4a853]">{content.hero.titleHighlight}</span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {content.hero.subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/portfolio"
              className="px-8 py-4 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition"
            >
              View My Work
            </Link>
            <Link
              href="/contact"
              className="px-8 py-4 border border-zinc-700 text-white rounded-lg hover:border-zinc-500 transition"
            >
              Get a Quote
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 border-2 border-zinc-600 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-[#d4a853] rounded-full mt-2 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-white text-center mb-4">
            What I <span className="text-[#d4a853]">Offer</span>
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Comprehensive carpentry services with attention to detail
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.services.map((service, i) => (
              <div
                key={i}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 hover:border-[#d4a853]/30 transition group"
              >
                <span className="text-4xl mb-4 block">{service.icon}</span>
                <h3 className="text-xl font-serif text-white mb-3 group-hover:text-[#d4a853] transition">
                  {service.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-serif text-white mb-4">
            {content.cta.title}{" "}
            <span className="text-[#d4a853]">{content.cta.titleHighlight}</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            {content.cta.subtitle}
          </p>
          <Link
            href="/contact"
            className="inline-block px-10 py-4 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition"
          >
            {content.cta.buttonText}
          </Link>
        </div>
      </section>
    </main>
  );
}
