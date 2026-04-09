import Image from "next/image";

const projects = [
  {
    id: 1,
    title: "Modern Kitchen Remodel",
    description:
      "Bespoke shaker-style kitchen in navy blue with brass handles and quartz worktops.",
    category: "Kitchens",
    image: "/images/projects/kitchen-remodel.jpg",
  },
  {
    id: 2,
    title: "Kitchen Island with Skylight",
    description:
      "Open-plan kitchen featuring a large island with integrated hob and bifold garden doors.",
    category: "Kitchens",
    image: "/images/projects/kitchen-island.jpg",
  },
  {
    id: 3,
    title: "Built-in Wardrobes",
    description:
      "Floor to ceiling fitted wardrobes with soft-close hinges and internal organisers.",
    category: "Cabinets",
    image: "/images/projects/built-in-wardrobes.jpg",
  },
  {
    id: 4,
    title: "Bespoke Alcove Shelving",
    description:
      "Custom alcove unit with floating shelves and panelled cupboard doors below.",
    category: "Cabinets",
    image: "/images/projects/bespoke-shelving.jpg",
  },
  {
    id: 5,
    title: "Garden Office Interior",
    description:
      "Fully fitted garden office with oak shelving, built-in desk area and AC unit.",
    category: "Outdoor",
    image: "/images/projects/garden-office.jpg",
  },
  {
    id: 6,
    title: "Outdoor Gym Structure",
    description:
      "Built during lockdown — a full timber frame outdoor gym with corner bracing for stability.",
    category: "Outdoor",
    image: "/images/projects/outdoor-gym.jpg",
  },
];

const categories = ["All", "Kitchens", "Cabinets", "Outdoor"];

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-[#0f1114] text-white">
      <section className="max-w-6xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-12">
          <div className="w-12 h-1 bg-[#d4a853] mb-6"></div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4">
            Built With <span className="text-[#d4a853]">Precision</span>
          </h1>
          <p className="text-gray-400 max-w-xl">
            From kitchens to outdoor structures — browse projects that show the
            standard of work you&apos;ll get.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-3 mb-12">
          {categories.map((cat) => (
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

        {/* Project Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <article
              key={project.id}
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
