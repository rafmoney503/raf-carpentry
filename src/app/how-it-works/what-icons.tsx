/* Small line drawings on the brief's "What is it?" choices (Raf, 22 Oct 2026: "should we add mini graphic
   miniatures?"). Picked by the choice's words, so a chip reworded in TinaCMS keeps its drawing; anything else gets
   a question mark. currentColor, so they turn white on a picked chip. */

const P: [RegExp, React.ReactNode][] = [
  [/wardrobe/i, <><rect x="3" y="2" width="22" height="20" /><path d="M14 2v20M11 11v3M17 11v3" /></>],
  [/alcove|chimney/i, <><path d="M2 22V4h7v18M19 22V4h7v18M9 8h10v14" /><path d="M2 14h7M19 14h7" /></>],
  [/book|shel/i, <><rect x="5" y="2" width="18" height="20" /><path d="M5 8h18M5 14h18M9 3.5v4.5M12 3.5v4.5M17 9.5v4.5" /></>],
  [/seat|bench/i, <><path d="M4 3h20v9H4zM14 3v9M2 14h24v3H2zM4 17v5M24 17v5" /></>],
  [/desk|office/i, <><path d="M2 10h24M4 10v12M24 10v12M16 10v6h8" /><rect x="9" y="3" width="8" height="5" /></>],
  [/loft|eaves/i, <><path d="M2 22V12L16 2h10v20z" /><path d="M8 22v-8M15 22V8" /></>],
  [/panel/i, <><rect x="2" y="2" width="24" height="20" /><rect x="5" y="5" width="7" height="7" /><rect x="16" y="5" width="7" height="7" /><path d="M2 15h24" /></>],
  [/kitchen/i, <><rect x="2" y="12" width="24" height="10" /><path d="M2 12h24M10 12v10M18 12v10M3 3h22v5H3z" /></>],
];

export function whatIcon(label: string) {
  const hit = P.find(([re]) => re.test(label));
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      {hit ? hit[1] : <><circle cx="14" cy="12" r="9" /><path d="M11.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1 1-1.1 1.8M14 16.5v.4" /></>}
    </svg>
  );
}
