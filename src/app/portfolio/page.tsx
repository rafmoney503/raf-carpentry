import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const defaultContent = {
  title: "My",
  titleHighlight: "Work",
  subtitle: "A selection of recent projects showcasing bespoke carpentry across London.",
  projects: [
    { id: 1, title: "Navy Shaker Kitchen", description: "Custom kitchen with brass handles and integrated appliances", category: "Kitchens", image: "/images/projects/kitchen-remodel.jpg" },
    { id: 2, title: "Kitchen Island", description: "Dark statement island with skylight above", category: "Kitchens", image: "/images/projects/kitchen-island.jpg" },
    { id: 3, title: "Built-in Wardrobes", description: "Floor-to-ceiling fitted wardrobes with internal lighting", category: "Cabinets", image: "/images/projects/built-in-wardrobes.jpg" },
    { id: 4, title: "Alcove Shelving", description: "Bespoke shelving unit with cupboards below", category: "Cabinets", image: "/images/projects/bespoke-shelving.jpg" },
    { id: 5, title: "Garden Office", description: "Insulated garden office with oak interior", category: "Outdoor", image: "/images/projects/garden-office.jpg" },
    { id: 6, title: "Outdoor Gym", description: "Timber frame outdoor gym structure", category: "Outdoor", image: "/images/projects/outdoor-gym.jpg" },
  ],
};

async function getContent() {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("content")
      .eq("id", "portfolio")
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

export default async function PortfolioPage() {
  const content = await getContent();

  // Get unique categories
  const categories = ["All", ...new Set(content.projects.map((p) => p.category))];

  return (
    <main className="min-h-screen bg-[#0f1114]">
      {/* Header */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-serif text-white mb-6">
            {content.title}{" "}
            <span className="text-[#d4a853]">{content.titleHighlight}</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {content.subtitle}
          </p>
        </div>
      </section>

      {/* Filter (visual only for now) */}
      <section className="px-6 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-5 py-2 rounded-full text-sm transition ${
                  cat === "All"
                    ? "bg-[#d4a853] text-black"
                    : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {content.projects.map((project) => (
              <div
                key={project.id}
                className="group bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-[#d4a853]/30 transition"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute top-4 left-4 px-3 py-1 bg-[#d4a853] text-black text-xs font-semibold rounded-full">
                    {project.category}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-serif text-white mb-2 group-hover:text-[#d4a853] transition">
                    {project.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {project.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-serif text-white mb-4">
            Like What You <span className="text-[#d4a853]">See?</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Let's create something amazing for your space
          </p>
          <Link
            href="/contact"
            className="inline-block px-10 py-4 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition"
          >
            Start Your Project
          </Link>
        </div>
      </section>
    </main>
  );
}
