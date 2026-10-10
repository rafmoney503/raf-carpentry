import fs from 'fs';
import path from 'path';
import type { Model3DInfo } from './projects';

/* Private 3D designs for customers, before a job is agreed: rafcarpentry.com/d/<code>.
   One JSON per design in content/designs/<code>.json; the code is random (e.g. "k7m2q9xd") so the page can't
   be guessed, and it is not linked anywhere, not in the sitemap and not in Google. Area only, never the
   customer's name or street. Each design has one or more options (e.g. flat or panelled doors), each its own
   SketchUp model made the same way as the job models (scripts/su-to-glb.mjs) into public/designs/<code>/. */

export type DesignOption = {
  name: string; // the tab, e.g. "Option A: panelled doors"
  text?: string; // a line about this option
  model: Model3DInfo;
  sizes?: { label: string; value: string }[]; // e.g. { label: "Width", value: "2400 mm" }
};

export type Design = {
  code: string;
  title: string; // e.g. "Fitted wardrobes"
  area: string; // e.g. "East Finchley"
  made: string; // YYYY-MM-DD
  intro?: string;
  options: DesignOption[];
  notes?: string[]; // what to check, e.g. "Sizes are from the measuring visit on 12 October."
  example?: boolean; // the demo page, labelled as an example
};

const dir = path.join(process.cwd(), 'content/designs');

export function getAllDesigns(): Design[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Design);
}

export const getDesign = (code: string) => getAllDesigns().find((d) => d.code === code);
