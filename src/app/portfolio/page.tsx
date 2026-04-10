import Image from "next/image";
import { readPageJson } from "@/lib/pages";

type PortfolioPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  categories: string[];
  projects: {
    title: string;
    description: string;
    category: string;
    image: string;
  }[];
};

export default function PortfolioPage() {
  const d = readPageJson<PortfolioPageData>("portfolio.json");

  return (
    <main className="min-h-screen bg-[#0f1114] text-white">
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <div className="w-12 h-1 bg-[#d4a853] mb-6"></div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4">
            {d.title}<span className="text-[#d4a853]">{d.titleAccent}</span>
          </h1>
          <p className="text-gray-400 max-w-xl">
            {d.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-12">
          {d.categories.map((cat) => (
            <button
              key={cat}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                cat === "All"
                  ? "bg-[#d4a853] text-black"
                  : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {d.projects.map((project, idx) => (
            <article
              key={`${project.title}-${idx}`}
              className="group bg-zinc-900 rounded-lg overflow-hidden hover:ring-1 hover:ring-[#d4a853]/50 transition"
            >
              <div className="relative h-56 overflow-hidden">
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div className="p-5">
                <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-[#d4a853]/20 text-[#d4a853] rounded mb-3">
                  {project.category}
                </span>
                <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                <p className="text-gray-400 text-sm">{project.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
