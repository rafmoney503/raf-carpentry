import { Container, SectionHeading } from '@/components/ui';
import { graphPaper } from '@/app/how-it-works/sketches';
import { COS_RULES, EXAMPLE, edgingMm, wardrobeParts } from '@/lib/cabinetos-sizes';
import { PartShape, RuleSketch, WardrobeDrawing, isSizeSketch, type SizeSketchName } from './sizes-sketches';

/* "How CabinetOS works out the sizes" on the CabinetOS page (Raf, 12 Oct 2026: the old "Zero calculation errors"
   promised too much; show how the sizes are worked out instead, with drawings). The words are in
   cabinetos.json (TinaCMS); every number comes from src/lib/cabinetos-sizes.ts, which follows CabinetOS's own
   rules and was checked against the app's cut list code. */

export type SizesRule = { drawing?: string; title?: string; text?: string };
export type SizesData = {
  kicker?: string;
  title?: string;
  titleAccent?: string;
  intro?: string;
  enterTitle?: string;
  enterText?: string;
  rules?: SizesRule[];
  drawnNote?: string;
  partsTitle?: string;
  partsIntro?: string;
  noteTitle?: string;
  note?: string;
};

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

export default function Sizes({ data }: { data: SizesData }) {
  const R = COS_RULES;
  const { widthMm: w, heightMm: h, depthMm: dp } = EXAMPLE;
  const t = R.boardMm;
  const parts = wardrobeParts(w, h, dp);
  const part = (k: string) => parts.find((p) => p.key === k)!;
  const side = part('side');
  const back = part('back');
  const shelf = part('shelf');
  const door = part('door');
  const doors = door.qty;
  const box = h - R.plinthMm;
  const sums = {
    side: num(side.length),
    inner: num(back.length),
    box: num(box),
    shelfW: num(shelf.length),
    shelfD: num(shelf.width),
    doorW: num(door.width),
    doorH: num(door.length),
    width: num(w),
  };
  const edgeM = (edgingMm(parts) / 1000).toFixed(2);
  const boardParts = parts.filter((p) => !p.hardware).reduce((a, p) => a + p.qty, 0);
  const g = R.shelfSideGapMm;
  const worked: Record<SizeSketchName, string> = {
    box: `Side: ${h} − ${R.plinthMm} − ${t} − ${t} = ${sums.side}`,
    plinth: `Plinth ${w} × ${R.plinthMm}. Box: ${h} − ${R.plinthMm} = ${box}`,
    back: `Back: ${w} − ${t} − ${t} = ${sums.inner} wide, ${sums.side} high`,
    shelf: `Shelf: ${sums.inner} − ${g} − ${g} = ${sums.shelfW} wide, ${dp} − ${R.backMm} − ${R.shelfFrontGapMm} = ${sums.shelfD} deep. Rail: ${sums.shelfW}`,
    doors:
      doors === 2
        ? `Each door: ${box} − ${R.doorTopGapMm} = ${sums.doorH} high, ${w} ÷ 2 − ${R.doorGapMm} = ${sums.doorW} wide`
        : `Door: ${box} − ${R.doorTopGapMm} = ${sums.doorH} high, ${w} − ${R.doorGapMm} = ${sums.doorW} wide`,
    edging: `${edgeM} m of edging tape`,
  };
  const rules = (data.rules ?? []).filter((r): r is SizesRule & { drawing: SizeSketchName } => isSizeSketch(r.drawing) && Boolean(r.title));
  const inside = `${doors === 2 ? 'Two doors' : 'One door'}, a shelf and a hanging rail`;
  const enter = [
    ['Width', `${w} mm`],
    ['Height', `${h} mm`],
    ['Depth', `${dp} mm`],
    ['Board', `${t} mm`],
    ['Inside', inside],
  ];

  return (
    <section id="sizes" aria-labelledby="sizes-title" className="scroll-mt-20 border-t border-line bg-raised py-20 md:py-28">
      <Container>
        {data.kicker ? <p className="kicker mb-4">{data.kicker}</p> : null}
        <SectionHeading>
          <span id="sizes-title">
            {data.title}
            <span className="text-accent">{data.titleAccent}</span>
          </span>
        </SectionHeading>
        {data.intro ? <p className="mt-4 max-w-[60ch] text-pretty text-muted">{data.intro}</p> : null}

        {/* What you enter: the wardrobe, to scale */}
        <div className="mount mt-10 grid grid-cols-1 p-0 md:mt-12 md:grid-cols-2">
          <div className="border-b border-line bg-paper px-6 py-7 md:border-b-0 md:border-r md:px-10 md:py-10" style={graphPaper}>
            <div className="mx-auto max-w-[360px]">
              <WardrobeDrawing
                w={w}
                h={h}
                d={dp}
                plinth={R.plinthMm}
                doors={doors}
                alt={`The example wardrobe from the front and the side: ${w} mm wide, ${h} mm high and ${dp} mm deep, ${doors === 2 ? 'two doors' : 'one door'} over a ${R.plinthMm} mm plinth`}
              />
            </div>
          </div>
          <div className="flex flex-col justify-center px-5 py-7 sm:px-6 md:px-10 md:py-10">
            {data.enterTitle ? <h3 className="text-[22px] font-[620] leading-tight md:text-[26px]">{data.enterTitle}</h3> : null}
            {data.enterText ? <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-muted md:text-base">{data.enterText}</p> : null}
            <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] border-t border-line font-mono text-[14px] md:text-[15px]">
              {enter.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="border-b border-line py-2.5 pr-6 text-faint">{k}</dt>
                  <dd className="border-b border-line py-2.5 text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* The rules, each with its drawing and the sum for this wardrobe */}
        {rules.length ? (
          <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rules.map((r, i) => (
              <li key={i} className="mount flex flex-col p-0">
                <RuleSketch name={r.drawing} sums={sums} />
                <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                  <h3 className="text-[19px] font-[620] leading-tight text-ink">
                    <span className="mr-2 font-mono text-[13px] font-normal text-accent">{String(i + 1).padStart(2, '0')}</span>
                    {r.title}
                  </h3>
                  {r.text ? <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{r.text}</p> : null}
                  <p className="mt-auto pt-4">
                    <span className="block border-t border-line pt-3 font-mono text-[12.5px] leading-relaxed text-accent">{worked[r.drawing]}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {data.drawnNote ? <p className="mt-4 font-mono text-[12.5px] text-faint">{data.drawnNote}</p> : null}

        {/* The whole wardrobe, part by part */}
        <div className="mount mt-10 p-0 md:mt-12">
          <div className="px-4 pb-5 pt-6 sm:px-5 md:px-8 md:pt-8">
            {data.partsTitle ? <h3 className="text-[22px] font-[620] leading-tight md:text-[26px]">{data.partsTitle}</h3> : null}
            {data.partsIntro ? <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted md:text-base">{data.partsIntro}</p> : null}
          </div>
          <table className="w-full border-collapse text-left [--s:0.042] sm:[--s:0.05] md:[--s:0.062]">
            <caption className="sr-only">
              Cut list for a wardrobe {w} mm wide, {h} mm high and {dp} mm deep
            </caption>
            <thead className="border-y border-line bg-paper font-mono text-[12px] text-faint md:text-[12.5px]">
              <tr>
                <th scope="col" className="w-[100px] py-2.5 pl-4 font-normal sm:w-[124px] sm:pl-5 md:w-[164px] md:pl-8">
                  To scale
                </th>
                <th scope="col" className="py-2.5 pl-3 font-normal">
                  Part
                </th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-normal sm:pr-5 md:pr-3 md:text-left">
                  Size, mm
                </th>
                <th scope="col" className="hidden py-2.5 pl-3 pr-8 font-normal md:table-cell">
                  How it&rsquo;s worked out
                </th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.key} className="border-b border-line">
                  <td className="py-3.5 pl-4 align-middle sm:pl-5 md:pl-8">
                    <PartShape part={p} />
                  </td>
                  <td className="py-3.5 pl-3 align-middle">
                    <span className="block text-[15px] font-[620] leading-tight text-ink md:text-base">
                      {p.name}
                      {p.qty > 1 ? <span className="font-mono text-[13px] font-normal text-accent"> × {p.qty}</span> : null}
                    </span>
                    {p.hardware ? <span className="block font-mono text-[11.5px] text-faint">Hardware</span> : null}
                    <span className="mt-1 block font-mono text-[11.5px] leading-snug text-faint md:hidden">{p.how}</span>
                  </td>
                  <td className="whitespace-nowrap py-3.5 pl-3 pr-4 text-right align-middle font-mono text-[14px] text-ink sm:pr-5 md:pr-3 md:text-left md:text-[15px]">
                    {p.hardware ? `${num(p.length)} long` : `${num(p.length)} × ${num(p.width)}`}
                  </td>
                  <td className="hidden py-3.5 pl-3 pr-8 align-middle font-mono text-[13px] leading-snug text-muted md:table-cell">{p.how}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="px-4 py-4 font-mono text-[12.5px] leading-relaxed text-faint sm:px-5 md:px-8">
                  {boardParts} parts in {t} mm board, a hanging rail and {edgeM} m of edging tape. Sizes are length × width, as the cut list shows them.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {data.note ? (
          <div className="mt-6 flex gap-4 rounded-sm border border-l-[3px] border-line-strong border-l-accent bg-mount px-5 py-5 md:px-8 md:py-6">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none text-accent" aria-hidden="true">
              <rect x="3" y="3" width="16" height="16" rx="1.5" />
              <path d="M7 11.3l2.8 2.8L15.2 8.4" />
            </svg>
            <div>
              {data.noteTitle ? <p className="font-[620] text-ink">{data.noteTitle}</p> : null}
              <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-muted">{data.note}</p>
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
