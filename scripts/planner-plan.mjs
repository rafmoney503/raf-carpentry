// The planners' sums for the 3D build: runs src/lib/planners/<kind>.ts (no runtime imports) with node's type
// stripping and prints {plan, summary} for scripts/planner-model.py.
//   node --experimental-strip-types --no-warnings scripts/planner-plan.mjs <alcove|bookcase|chest> spec.json
import fs from 'node:fs';

const [kind, file] = process.argv.slice(2);
const names = { alcove: ['planAlcove', 'alcoveSummary'], bookcase: ['planBookcase', 'bookcaseSummary'], chest: ['planChest', 'chestSummary'] };
if (!names[kind]) {
  console.error('kind must be alcove, bookcase or chest');
  process.exit(1);
}
const mod = await import(new URL(`../src/lib/planners/${kind}.ts`, import.meta.url));
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const [planFn, sumFn] = names[kind];
console.log(JSON.stringify({ plan: mod[planFn](spec), summary: mod[sumFn](spec) }));
