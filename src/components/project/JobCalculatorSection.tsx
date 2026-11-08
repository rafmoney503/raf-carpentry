import { Container, SectionHeading } from '@/components/ui';
import DeckingCalculator from '@/app/tools/decking-calculator/decking-calculator';
import { deckInput, framesInput, gridInput, type JobCalculator } from '@/lib/job-calculators';
import PanellingCalculator from './PanellingCalculator';
import PictureFramesCalculator from './PictureFramesCalculator';

/* "Work out your own wall / deck" on a job page, after the steps (#calculator): the job's calculator started with
   its sizes (src/lib/job-calculators.ts). The batten grid since 8 Nov 2026 (Barnet), picture frames and decking the
   same day, and any Job Kit job that brings one. */

const WHAT = {
  'batten-grid': { tool: 'batten grid', follow: 'the drawing, the openings and the cut list follow' },
  'picture-frames': { tool: 'picture frames', follow: 'the frames, the gaps and the moulding to buy follow' },
  decking: { tool: '', follow: 'the boards, the frame under them and everything to buy follow' },
} as const;

/** the link at the top of the page */
export const calcLinkWords = (c: JobCalculator) => (c.kind === 'decking' ? 'Work out your deck' : 'Work out your wall');

export default function JobCalculatorSection({ c, slug }: { c: JobCalculator; slug: string }) {
  const page = `/portfolio/${slug}`;
  const w = WHAT[c.kind];
  const sizes = c.standardSizes ? `standard sizes for ${c.kind === 'decking' ? 'a deck' : 'a wall'} like this one` : 'this job’s sizes';
  const intro =
    c.kind === 'decking'
      ? `My free decking calculator, started with ${sizes}: put in yours and ${w.follow}.`
      : c.standardSizes
        ? `The ${w.tool} from my free Workshop Tools app, started with ${sizes}: put in yours and ${w.follow}.`
        : `The same ${w.tool} I set this wall out with in my Workshop Tools app. It starts with ${sizes}: put in yours and ${w.follow}.`;
  return (
    <section id="calculator" className="scroll-mt-24 border-t border-line" data-job-calculator={c.kind}>
      <Container className="py-16 md:py-24">
        <div className="max-w-[640px]">
          <p className="kicker">Free calculator</p>
          <SectionHeading className="mt-3">{c.kind === 'decking' ? 'Work out your own deck' : 'Work out your own wall'}</SectionHeading>
          <p className="mt-4 text-pretty text-muted">{intro}</p>
        </div>
        <div className="mt-10">
          {c.kind === 'batten-grid' ? (
            <PanellingCalculator start={gridInput(c)} job={slug} page={page} />
          ) : c.kind === 'picture-frames' ? (
            <PictureFramesCalculator start={framesInput(c)} job={slug} page={page} />
          ) : (
            <DeckingCalculator start={deckInput(c)} job={slug} inPage />
          )}
        </div>
      </Container>
    </section>
  );
}
