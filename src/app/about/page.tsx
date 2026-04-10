import { supabase } from "@/lib/supabase";

const defaultContent = {
  hero: {
    title: "About",
    titleHighlight: "Raf Carpentry",
    subtitle: "With years of experience in bespoke carpentry and joinery, I bring craftsmanship and attention to detail to every project across London.",
  },
  stats: [
    { number: "10+", label: "Years Experience" },
    { number: "200+", label: "Projects Completed" },
    { number: "100%", label: "Client Satisfaction" },
  ],
};

async function getContent() {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("content")
      .eq("id", "about")
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

export default async function AboutPage() {
  const content = await getContent();

  return (
    <main className="min-h-screen bg-[#0f1114]">
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-serif text-white mb-6">
            {content.hero.title}{" "}
            <span className="text-[#d4a853]">{content.hero.titleHighlight}</span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            {content.hero.subtitle}
          </p>
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

      {/* Story */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-serif text-white mb-8">
            The <span className="text-[#d4a853]">Story</span>
          </h2>
          <div className="space-y-6 text-gray-400 leading-relaxed">
            <p>
              I started my carpentry journey over a decade ago, learning the traditional skills 
              that form the foundation of quality woodwork. Since then, I&apos;ve had the privilege 
              of working on hundreds of projects across London.
            </p>
            <p>
              Every project I take on receives my full attention and dedication. Whether it&apos;s 
              a custom kitchen, fitted wardrobes, or a garden structure, I believe in doing 
              things right the first time.
            </p>
            <p>
              What sets my work apart is the combination of traditional craftsmanship with 
              modern design tools like SketchUp. This allows you to visualise your project 
              in 3D before any work begins, ensuring we&apos;re aligned on every detail.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Me */}
      <section className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-serif text-white text-center mb-16">
            Why Choose <span className="text-[#d4a853]">Me</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-serif text-white mb-3">Precision</h3>
              <p className="text-gray-400 text-sm">
                Every measurement, every cut, every finish is executed with meticulous attention to detail.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-serif text-white mb-3">Communication</h3>
              <p className="text-gray-400 text-sm">
                Clear, honest communication throughout your project. No surprises, just results.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="text-xl font-serif text-white mb-3">Quality</h3>
              <p className="text-gray-400 text-sm">
                Using premium materials and proven techniques to ensure lasting craftsmanship.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
