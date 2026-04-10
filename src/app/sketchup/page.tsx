import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const defaultContent = {
  hero: {
    badge: "THE PROCESS",
    title: "See It Before",
    titleHighlight: "It's Built",
    paragraphs: [
      "Using SketchUp 3D modelling, I create detailed visualisations of your project before any work begins. This means no surprises — you'll know exactly what you're getting.",
    ],
  },
  benefits: [
    { icon: "📐", title: "Precise Dimensions", description: "Every measurement is accurate to the millimetre, ensuring a perfect fit." },
    { icon: "🎨", title: "Material Preview", description: "See how different woods, colours, and finishes will look in your space." },
    { icon: "🔄", title: "Easy Changes", description: "Want to adjust something? Changes can be made instantly in the 3D model." },
    { icon: "💰", title: "Accurate Quotes", description: "Detailed models mean accurate material lists and precise pricing." },
  ],
  stats: [
    { number: "100%", label: "Client Approval" },
    { number: "0", label: "Surprises" },
    { number: "3D", label: "Visualisation" },
  ],
};

async function getContent() {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("content")
      .eq("id", "sketchup")
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

export default async function SketchUpPage() {
  const content = await getContent();

  return (
    <main className="min-h-screen bg-[#0f1114]">
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-4 py-2 text-xs tracking-[0.3em] text-[#d4a853] border border-[#d4a853]/30 rounded-full mb-8 uppercase">
                {content.hero.badge}
              </span>
              
              <h1 className="text-5xl md:text-6xl font-serif text-white leading-tight mb-6">
                {content.hero.title}{" "}
                <span className="text-[#d4a853]">{content.hero.titleHighlight}</span>
              </h1>
              
              <div className="space-y-4 text-gray-400 leading-relaxed mb-8">
                {(content.hero.paragraphs || []).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              
              <Link
                href="/contact"
                className="inline-block px-8 py-4 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition"
              >
                Start Your Design
              </Link>
            </div>
            
            <div className="relative">
              <div className="aspect-square bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                <Image
                  src="/images/sketchup/wardrobe-model.png"
                  alt="SketchUp 3D wardrobe model"
                  fill
                  className="object-contain p-4"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-[#d4a853] text-black px-4 py-2 rounded-lg font-semibold text-sm">
                3D Model Preview
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-white text-center mb-4">
            Why <span className="text-[#d4a853]">SketchUp?</span>
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Modern tools for better results
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.benefits.map((benefit, i) => (
              <div
                key={i}
                className="bg-[#0f1114] border border-zinc-800 rounded-2xl p-8 hover:border-[#d4a853]/30 transition"
              >
                <span className="text-4xl mb-4 block">{benefit.icon}</span>
                <h3 className="text-xl font-serif text-white mb-3">{benefit.title}</h3>
                <p className="text-gray-400 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-zinc-800">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8">
            {content.stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-serif text-[#d4a853] mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-400 text-sm uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-white text-center mb-16">
            The <span className="text-[#d4a853]">Process</span>
          </h2>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#d4a853] text-black rounded-full flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div>
                <h3 className="text-xl font-serif text-white mb-2">Initial Consultation</h3>
                <p className="text-gray-400">We discuss your requirements, measure your space, and talk through ideas.</p>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#d4a853] text-black rounded-full flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="text-xl font-serif text-white mb-2">3D Design</h3>
                <p className="text-gray-400">I create a detailed 3D model showing exactly how your project will look.</p>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#d4a853] text-black rounded-full flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="text-xl font-serif text-white mb-2">Refine & Approve</h3>
                <p className="text-gray-400">We review together, make any changes you want, until it's perfect.</p>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#d4a853] text-black rounded-full flex items-center justify-center font-bold shrink-0">
                4
              </div>
              <div>
                <h3 className="text-xl font-serif text-white mb-2">Build</h3>
                <p className="text-gray-400">With the approved design, I build your project exactly as visualised.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-serif text-white mb-4">
            Ready to <span className="text-[#d4a853]">Visualise</span> Your Project?
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Let's create a 3D model of your dream space
          </p>
          <Link
            href="/contact"
            className="inline-block px-10 py-4 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition"
          >
            Get Started
          </Link>
        </div>
      </section>
    </main>
  );
}
