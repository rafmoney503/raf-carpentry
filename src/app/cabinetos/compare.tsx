import CompareSketch, { COMPARE_SKETCHES } from './compare-sketches';

/* "Without / With" on the CabinetOS page, as one table: each row puts the old way next to the app way, with a
   drawing of each, so the pair reads across (side by side on a phone too). Rows pair the two lists in the JSON
   by order; drawing 1 goes with row 1 (sums), 2 the board, 3 the size, 4 the cut sheet, then round again. */

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-full top-1/2 z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm bg-accent text-on-accent md:h-9 md:w-9"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7h10M8 3l4 4-4 4" />
      </svg>
    </span>
  );
}

export default function Compare({
  withoutTitle,
  withTitle,
  without,
  withList,
  note,
}: {
  withoutTitle: string;
  withTitle: string;
  without: string[];
  withList: string[];
  note?: string;
}) {
  const rows = Array.from({ length: Math.max(without.length, withList.length) }, (_, i) => ({
    before: without[i] ?? '',
    after: withList[i] ?? '',
    sketch: COMPARE_SKETCHES[i % COMPARE_SKETCHES.length],
  }));
  const cell = 'flex flex-col gap-3 px-3.5 py-5 sm:px-5 md:flex-row md:items-center md:gap-6 md:px-8 md:py-7';
  const pic = 'w-[72px] flex-none md:w-[84px]';

  return (
    <div className="mount mt-10 p-0 md:mt-12">
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr>
            <th scope="col" className="w-1/2 border-r border-line px-3.5 pb-4 pt-5 align-top sm:px-5 md:px-8 md:pb-5 md:pt-7">
              <span className="block font-mono text-[12px] font-normal text-faint md:text-[13px]">The old way</span>
              <span className="mt-1 block text-[19px] font-[620] leading-tight text-muted md:text-[25px]">{withoutTitle}</span>
            </th>
            <th scope="col" className="w-1/2 bg-accent-soft px-3.5 pb-4 pt-5 align-top sm:px-5 md:px-8 md:pb-5 md:pt-7">
              <span className="block font-mono text-[12px] font-normal text-accent md:text-[13px]">The app way</span>
              <span className="mt-1 block text-[19px] font-[620] leading-tight text-accent md:text-[25px]">{withTitle}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="relative border-r border-line p-0 align-top">
                <div className={cell}>
                  <div className={pic}>
                    <CompareSketch name={r.sketch} side="without" />
                  </div>
                  <p className="text-[15px] leading-snug text-muted md:text-[17px]">{r.before}</p>
                </div>
                <Arrow />
              </td>
              <td className="bg-accent-soft p-0 align-top">
                <div className={cell}>
                  <div className={pic}>
                    <CompareSketch name={r.sketch} side="with" />
                  </div>
                  <p className="text-[15px] font-semibold leading-snug text-ink md:text-[17px]">{r.after}</p>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="border-t border-line px-3.5 py-4 font-mono text-[12.5px] leading-relaxed text-faint sm:px-5 md:px-8 md:text-[13px]">{note}</p> : null}
    </div>
  );
}
