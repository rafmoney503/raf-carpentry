"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const EDITOR_PASSWORD = "raf2024"; // Change this!

type PageContent = Record<string, unknown>;

export default function EditorPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [pages, setPages] = useState<Record<string, PageContent>>({});
  const [activePage, setActivePage] = useState("homepage");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const pageList = ["homepage", "about", "sketchup", "contact", "portfolio"];

  // Load content from Supabase
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadContent() {
      setLoading(true);
      const { data, error } = await supabase.from("pages").select("id, content");

      if (!error && data) {
        const pagesData: Record<string, PageContent> = {};
        data.forEach((page) => {
          pagesData[page.id] = page.content;
        });
        setPages(pagesData);
      }
      setLoading(false);
    }

    loadContent();
  }, [isAuthenticated]);

  // Save to Supabase
  const saveContent = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("pages")
      .update({ content: pages[activePage], updated_at: new Date().toISOString() })
      .eq("id", activePage);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  // Update local state
  const updateField = (path: string, value: string) => {
    setPages((prev) => {
      const newPages = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = newPages[activePage];
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newPages;
    });
    setSaved(false);
  };

  const updateArrayField = (path: string, index: number, field: string, value: string) => {
    setPages((prev) => {
      const newPages = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = newPages[activePage];
      for (const key of keys) {
        obj = obj[key];
      }
      obj[index][field] = value;
      return newPages;
    });
    setSaved(false);
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#0f1114] flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-2xl p-8 w-full max-w-sm border border-zinc-800">
          <h1 className="text-2xl font-serif text-white mb-2">Editor Login</h1>
          <p className="text-gray-400 text-sm mb-6">Enter password to edit your website</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password === EDITOR_PASSWORD) {
                setIsAuthenticated(true);
              }
            }}
            placeholder="Password"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white mb-4 focus:border-[#d4a853] focus:outline-none"
          />
          <button
            onClick={() => {
              if (password === EDITOR_PASSWORD) {
                setIsAuthenticated(true);
              }
            }}
            className="w-full bg-[#d4a853] text-black font-semibold py-3 rounded-lg hover:bg-[#c49843] transition"
          >
            Enter Editor
          </button>
          {password && password !== EDITOR_PASSWORD && (
            <p className="text-red-400 text-sm mt-3 text-center">Wrong password</p>
          )}
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f1114] flex items-center justify-center">
        <div className="text-[#d4a853]">Loading editor...</div>
      </main>
    );
  }

  const currentContent = pages[activePage] || {};

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f1114] border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-serif">
              <span className="text-[#d4a853]">Raf Carpentry</span> Editor
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-400 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </span>
            )}
            <a
              href={`/${activePage === "homepage" ? "" : activePage}`}
              target="_blank"
              className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
            >
              View Page →
            </a>
            <button
              onClick={saveContent}
              disabled={saving}
              className="px-6 py-2 bg-[#d4a853] text-black font-semibold rounded-lg hover:bg-[#c49843] transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {pageList.map((page) => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`px-5 py-2.5 rounded-lg capitalize transition whitespace-nowrap ${
                activePage === page
                  ? "bg-[#d4a853] text-black font-medium"
                  : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Editor content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Edit Panel */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#d4a853] capitalize">
              Edit {activePage} Page
            </h2>

            {/* HOMEPAGE */}
            {activePage === "homepage" && currentContent && (
              <div className="space-y-6">
                <Section title="Hero Section">
                  <Field
                    label="Badge Text"
                    value={(currentContent as any).hero?.badge || ""}
                    onChange={(v) => updateField("hero.badge", v)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Title"
                      value={(currentContent as any).hero?.title || ""}
                      onChange={(v) => updateField("hero.title", v)}
                    />
                    <Field
                      label="Title (Gold)"
                      value={(currentContent as any).hero?.titleHighlight || ""}
                      onChange={(v) => updateField("hero.titleHighlight", v)}
                      gold
                    />
                  </div>
                  <Field
                    label="Subtitle"
                    value={(currentContent as any).hero?.subtitle || ""}
                    onChange={(v) => updateField("hero.subtitle", v)}
                    multiline
                  />
                </Section>

                <Section title="Services">
                  {((currentContent as any).services || []).map((service: any, i: number) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="w-20">
                          <label className="block text-xs text-gray-500 mb-1">Icon</label>
                          <input
                            type="text"
                            value={service.icon}
                            onChange={(e) => updateArrayField("services", i, "icon", e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-2 text-center text-2xl focus:border-[#d4a853] focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Title</label>
                          <input
                            type="text"
                            value={service.title}
                            onChange={(e) => updateArrayField("services", i, "title", e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white focus:border-[#d4a853] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                        <textarea
                          value={service.description}
                          onChange={(e) => updateArrayField("services", i, "description", e.target.value)}
                          rows={2}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white focus:border-[#d4a853] focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </Section>

                <Section title="Call to Action">
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Title"
                      value={(currentContent as any).cta?.title || ""}
                      onChange={(v) => updateField("cta.title", v)}
                    />
                    <Field
                      label="Title (Gold)"
                      value={(currentContent as any).cta?.titleHighlight || ""}
                      onChange={(v) => updateField("cta.titleHighlight", v)}
                      gold
                    />
                  </div>
                  <Field
                    label="Subtitle"
                    value={(currentContent as any).cta?.subtitle || ""}
                    onChange={(v) => updateField("cta.subtitle", v)}
                    multiline
                  />
                  <Field
                    label="Button Text"
                    value={(currentContent as any).cta?.buttonText || ""}
                    onChange={(v) => updateField("cta.buttonText", v)}
                  />
                </Section>
              </div>
            )}

            {/* ABOUT */}
            {activePage === "about" && currentContent && (
              <div className="space-y-6">
                <Section title="Hero">
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Title"
                      value={(currentContent as any).hero?.title || ""}
                      onChange={(v) => updateField("hero.title", v)}
                    />
                    <Field
                      label="Title (Gold)"
                      value={(currentContent as any).hero?.titleHighlight || ""}
                      onChange={(v) => updateField("hero.titleHighlight", v)}
                      gold
                    />
                  </div>
                  <Field
                    label="Subtitle"
                    value={(currentContent as any).hero?.subtitle || ""}
                    onChange={(v) => updateField("hero.subtitle", v)}
                    multiline
                  />
                </Section>

                <Section title="Stats">
                  {((currentContent as any).stats || []).map((stat: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-24">
                        <label className="block text-xs text-gray-500 mb-1">Number</label>
                        <input
                          type="text"
                          value={stat.number}
                          onChange={(e) => updateArrayField("stats", i, "number", e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-[#d4a853] font-bold focus:border-[#d4a853] focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Label</label>
                        <input
                          type="text"
                          value={stat.label}
                          onChange={(e) => updateArrayField("stats", i, "label", e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:border-[#d4a853] focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </Section>
              </div>
            )}

            {/* SKETCHUP */}
            {activePage === "sketchup" && currentContent && (
              <div className="space-y-6">
                <Section title="Hero">
                  <Field
                    label="Badge"
                    value={(currentContent as any).hero?.badge || ""}
                    onChange={(v) => updateField("hero.badge", v)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Title"
                      value={(currentContent as any).hero?.title || ""}
                      onChange={(v) => updateField("hero.title", v)}
                    />
                    <Field
                      label="Title (Gold)"
                      value={(currentContent as any).hero?.titleHighlight || ""}
                      onChange={(v) => updateField("hero.titleHighlight", v)}
                      gold
                    />
                  </div>
                </Section>

                <Section title="Benefits">
                  {((currentContent as any).benefits || []).map((benefit: any, i: number) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="w-20">
                          <label className="block text-xs text-gray-500 mb-1">Icon</label>
                          <input
                            type="text"
                            value={benefit.icon}
                            onChange={(e) => updateArrayField("benefits", i, "icon", e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-2 text-center text-2xl focus:border-[#d4a853] focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Title</label>
                          <input
                            type="text"
                            value={benefit.title}
                            onChange={(e) => updateArrayField("benefits", i, "title", e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white focus:border-[#d4a853] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                        <textarea
                          value={benefit.description}
                          onChange={(e) => updateArrayField("benefits", i, "description", e.target.value)}
                          rows={2}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white focus:border-[#d4a853] focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </Section>

                <Section title="Stats">
                  {((currentContent as any).stats || []).map((stat: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-24">
                        <label className="block text-xs text-gray-500 mb-1">Number</label>
                        <input
                          type="text"
                          value={stat.number}
                          onChange={(e) => updateArrayField("stats", i, "number", e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-[#d4a853] font-bold focus:border-[#d4a853] focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Label</label>
                        <input
                          type="text"
                          value={stat.label}
                          onChange={(e) => updateArrayField("stats", i, "label", e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:border-[#d4a853] focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </Section>
              </div>
            )}

            {/* CONTACT */}
            {activePage === "contact" && currentContent && (
              <div className="space-y-6">
                <Section title="Contact Info">
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Title"
                      value={(currentContent as any).title || ""}
                      onChange={(v) => updateField("title", v)}
                    />
                    <Field
                      label="Title (Gold)"
                      value={(currentContent as any).titleHighlight || ""}
                      onChange={(v) => updateField("titleHighlight", v)}
                      gold
                    />
                  </div>
                  <Field
                    label="Subtitle"
                    value={(currentContent as any).subtitle || ""}
                    onChange={(v) => updateField("subtitle", v)}
                    multiline
                  />
                  <Field
                    label="Email"
                    value={(currentContent as any).email || ""}
                    onChange={(v) => updateField("email", v)}
                  />
                  <Field
                    label="Phone"
                    value={(currentContent as any).phone || ""}
                    onChange={(v) => updateField("phone", v)}
                  />
                  <Field
                    label="Location"
                    value={(currentContent as any).location || ""}
                    onChange={(v) => updateField("location", v)}
                  />
                </Section>
              </div>
            )}

            {/* PORTFOLIO */}
            {activePage === "portfolio" && currentContent && (
              <div className="space-y-6">
                <Section title="Page Header">
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Title"
                      value={(currentContent as any).title || ""}
                      onChange={(v) => updateField("title", v)}
                    />
                    <Field
                      label="Title (Gold)"
                      value={(currentContent as any).titleHighlight || ""}
                      onChange={(v) => updateField("titleHighlight", v)}
                      gold
                    />
                  </div>
                  <Field
                    label="Subtitle"
                    value={(currentContent as any).subtitle || ""}
                    onChange={(v) => updateField("subtitle", v)}
                    multiline
                  />
                </Section>

                <Section title="Projects">
                  {((currentContent as any).projects || []).map((project: any, i: number) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-4 space-y-3">
                      <Field
                        label="Title"
                        value={project.title}
                        onChange={(v) => updateArrayField("projects", i, "title", v)}
                      />
                      <Field
                        label="Description"
                        value={project.description}
                        onChange={(v) => updateArrayField("projects", i, "description", v)}
                        multiline
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Field
                          label="Category"
                          value={project.category}
                          onChange={(v) => updateArrayField("projects", i, "category", v)}
                        />
                        <Field
                          label="Image Path"
                          value={project.image}
                          onChange={(v) => updateArrayField("projects", i, "image", v)}
                        />
                      </div>
                    </div>
                  ))}
                </Section>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#d4a853]">Live Preview</h2>
            <div className="bg-[#0f1114] rounded-2xl p-8 border border-zinc-800 min-h-[400px]">
              <Preview page={activePage} content={currentContent} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  gold,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  gold?: boolean;
}) {
  const className = `w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:border-[#d4a853] focus:outline-none resize-none ${
    gold ? "text-[#d4a853]" : "text-white"
  }`;

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={className} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </div>
  );
}

function Preview({ page, content }: { page: string; content: any }) {
  if (!content) return <div className="text-gray-500">Loading...</div>;

  if (page === "homepage") {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <span className="inline-block px-3 py-1 text-xs tracking-widest text-[#d4a853] border border-[#d4a853]/30 rounded-full mb-4">
            {content.hero?.badge}
          </span>
          <h1 className="text-3xl font-serif">
            {content.hero?.title}
            <span className="block text-[#d4a853]">{content.hero?.titleHighlight}</span>
          </h1>
          <p className="text-gray-400 mt-3 text-sm">{content.hero?.subtitle}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(content.services || []).map((s: any, i: number) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <span className="text-2xl">{s.icon}</span>
              <h3 className="text-xs font-medium mt-2">{s.title}</h3>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === "contact") {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif">
          {content.title} <span className="text-[#d4a853]">{content.titleHighlight}</span>
        </h1>
        <p className="text-gray-400 text-sm">{content.subtitle}</p>
        <div className="space-y-2 text-sm pt-4">
          <p>📧 {content.email}</p>
          <p>📱 {content.phone}</p>
          <p>📍 {content.location}</p>
        </div>
      </div>
    );
  }

  if (page === "about") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-serif">
            {content.hero?.title} <span className="text-[#d4a853]">{content.hero?.titleHighlight}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">{content.hero?.subtitle}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-4">
          {(content.stats || []).map((s: any, i: number) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-serif text-[#d4a853]">{s.number}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === "sketchup") {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block px-3 py-1 text-xs tracking-widest text-[#d4a853] border border-[#d4a853]/30 rounded-full mb-3">
            {content.hero?.badge}
          </span>
          <h1 className="text-3xl font-serif">
            {content.hero?.title} <span className="text-[#d4a853]">{content.hero?.titleHighlight}</span>
          </h1>
        </div>
        <div className="space-y-3">
          {(content.benefits || []).map((b: any, i: number) => (
            <div key={i} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-3">
              <span className="text-xl">{b.icon}</span>
              <div>
                <h3 className="text-sm font-medium">{b.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === "portfolio") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-serif">
            {content.title} <span className="text-[#d4a853]">{content.titleHighlight}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">{content.subtitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(content.projects || []).slice(0, 4).map((p: any, i: number) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-[#d4a853] mb-1">{p.category}</div>
              <div className="text-sm font-medium">{p.title}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
