import Image from "next/image";

const benefits = [
  {
    icon: "🎯",
    title: "Client Visualisation",
    description:
      "Show clients photorealistic renders. Get sign-off before you start — no surprises, no disputes.",
  },
  {
    icon: "📐",
    title: "Precision Planning",
    description:
      "Every measurement is accurate. Export dimensions directly to your cut list or Cabinetos.",
  },
  {
    icon: "💰",
    title: "Better Quotes",
    description:
      "Measure materials from the model, price accurately, and win more jobs with professional presentations.",
  },
];

export default function SketchUpPage() {
  return (
    <main className="min-h-screen bg-[#0f1114] text-white">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8">
            <h1 className="text-3xl font-serif mb-6">
              Why I Use <span className="text-[#d4a853]">SketchUp</span>
            </h1>
            <div className="space-y-4 text-gray-300">
              <p>
                When I started using SketchUp, it completely transformed my
                workflow. Clients could see exactly what they were getting before I
                ordered a single board. Mistakes dropped to almost zero. Material
                waste went down. And quoting became faster because I could measure
                everything digitally.
              </p>
              <p>
                Today, every project I take on starts in SketchUp. It&apos;s become as
                essential as my tape measure.
              </p>
            </div>
          </div>

          {/* Right - SketchUp Model Image */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-white">
              <Image
                src="/images/sketchup/wardrobe-model.png"
                alt="SketchUp wardrobe design with dimensions"
                fill
                className="object-contain p-4"
              />
            </div>
            <p className="text-center text-gray-400 text-sm mt-3">
              Fitted wardrobe — designed in SketchUp with precise dimensions
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-serif text-center mb-12">
          Benefits for <span className="text-[#d4a853]">Carpenters</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6"
            >
              <div className="text-3xl mb-4">{benefit.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3D vs Real Builds Section */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-serif text-center mb-4">
          3D Designs <span className="text-[#d4a853]">vs Real Builds</span>
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
          See how my SketchUp models translate into finished projects. Every detail
          planned digitally, then built to perfection.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-white mb-4">
              <Image
                src="/images/sketchup/wardrobe-model.png"
                alt="SketchUp wardrobe design"
                fill
                className="object-contain p-4"
              />
            </div>
            <p className="text-center text-[#d4a853] font-medium">SketchUp Design</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-800 mb-4">
              <Image
                src="/images/projects/built-in-wardrobes.jpg"
                alt="Finished fitted wardrobes"
                fill
                className="object-cover"
              />
            </div>
            <p className="text-center text-[#d4a853] font-medium">Finished Build</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-700 rounded-lg p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            Want a 3D Design for Your Project?
          </h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            I create detailed SketchUp models for every bespoke project. See exactly
            what you&apos;re getting before a single cut is made.
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-3 bg-[#d4a853] text-black font-semibold rounded hover:bg-[#c49843] transition"
          >
            Get in Touch
          </a>
        </div>
      </section>
    </main>
  );
}
