import Image from "next/image";
import { readPageJson } from "@/lib/pages";

type SketchupPageData = {
  heroTitle: string;
  heroTitleAccent: string;
  heroParagraphs: string[];
  heroImage: string;
  heroImageAlt: string;
  heroImageCaption: string;
  benefitsSectionTitle: string;
  benefitsSectionTitleAccent: string;
  benefits: { title: string; description: string; icon: string }[];
  comparisonTitle: string;
  comparisonTitleAccent: string;
  comparisonSubtitle: string;
  comparisonModelImage: string;
  comparisonModelAlt: string;
  comparisonModelLabel: string;
  comparisonBuildImage: string;
  comparisonBuildAlt: string;
  comparisonBuildLabel: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonLabel: string;
};

export default function SketchUpPage() {
  const d = readPageJson<SketchupPageData>("sketchup.json");

  return (
    <main className="min-h-screen bg-[#0f1114] text-white">
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8">
            <h1 className="text-3xl font-serif mb-6">
              {d.heroTitle}<span className="text-[#d4a853]">{d.heroTitleAccent}</span>
            </h1>
            <div className="space-y-4 text-gray-300">
              {d.heroParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-white">
              <Image
                src={d.heroImage}
                alt={d.heroImageAlt}
                fill
                className="object-contain p-4"
              />
            </div>
            <p className="text-center text-gray-400 text-sm mt-3">
              {d.heroImageCaption}
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-serif text-center mb-12">
          {d.benefitsSectionTitle}<span className="text-[#d4a853]">{d.benefitsSectionTitleAccent}</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {d.benefits.map((benefit, index) => (
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

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-serif text-center mb-4">
          {d.comparisonTitle}<span className="text-[#d4a853]">{d.comparisonTitleAccent}</span>
        </h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
          {d.comparisonSubtitle}
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-white mb-4">
              <Image
                src={d.comparisonModelImage}
                alt={d.comparisonModelAlt}
                fill
                className="object-contain p-4"
              />
            </div>
            <p className="text-center text-[#d4a853] font-medium">{d.comparisonModelLabel}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-800 mb-4">
              <Image
                src={d.comparisonBuildImage}
                alt={d.comparisonBuildAlt}
                fill
                className="object-cover"
              />
            </div>
            <p className="text-center text-[#d4a853] font-medium">{d.comparisonBuildLabel}</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-700 rounded-lg p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            {d.ctaTitle}
          </h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            {d.ctaSubtitle}
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-3 bg-[#d4a853] text-black font-semibold rounded hover:bg-[#c49843] transition"
          >
            {d.ctaButtonLabel}
          </a>
        </div>
      </section>
    </main>
  );
}
