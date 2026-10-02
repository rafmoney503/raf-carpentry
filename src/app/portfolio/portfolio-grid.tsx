'use client';
import { useState } from 'react';
import { MountedImage } from '@/components/ui';

export type Project = { title: string; description: string; category: string; image: string };

export default function PortfolioGrid({ categories, projects }: { categories: string[]; projects: Project[] }) {
  const [active, setActive] = useState(categories[0] ?? 'All');
  const shown = active === 'All' ? projects : projects.filter((p) => p.category === active);

  return (
    <>
      <div className="mb-12 flex flex-wrap gap-2" role="group" aria-label="Filter projects">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            aria-pressed={cat === active}
            className="h-11 rounded-sm border border-line-strong px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {cat}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="border-t border-line pt-8 text-muted">No projects in this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((project, idx) => (
            <article key={`${project.title}-${idx}`} className="group">
              <MountedImage
                src={project.image}
                alt={project.title}
                aspect="aspect-[4/3]"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
                className="group-hover:border-accent"
              />
              <p className="mt-5 font-mono text-[13px] text-faint">{project.category}</p>
              <h3 className="mt-1.5 text-[23px] font-[620] leading-tight">{project.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-muted">{project.description}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
