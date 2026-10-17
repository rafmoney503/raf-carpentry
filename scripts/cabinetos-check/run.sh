#!/usr/bin/env bash
# Checks the wardrobe planner's units (src/lib/cabinetos-wardrobe.ts) against CabinetOS's own code: see check.ts.
# Needs the cabinetos-site checkout next to this one (or COS=/path/to/cabinetos-site) with its node_modules.
# Options: N=3000 (designs), SEED=7.
set -euo pipefail
cd "$(dirname "$0")/../.."
COS=${COS:-$(cd ../cabinetos-site 2>/dev/null && pwd || true)}
if [ ! -d "$COS/src/lib" ] || [ ! -d "$COS/node_modules" ]; then
  echo "Needs the cabinetos-site checkout with node_modules: put it next to this folder or set COS=/path/to/cabinetos-site" >&2
  exit 2
fi
# CabinetOS keeps an exact copy of the rules file (src/lib/plannerWardrobe.ts) for its Sliding doors card's inside
# presets: the two must stay the same, so the check proves the card's units too.
if ! cmp -s src/lib/cabinetos-wardrobe.ts "$COS/src/lib/plannerWardrobe.ts"; then
  echo "FAIL: cabinetos-site src/lib/plannerWardrobe.ts differs from src/lib/cabinetos-wardrobe.ts. Copy this one over:" >&2
  echo "  cp src/lib/cabinetos-wardrobe.ts \"$COS/src/lib/plannerWardrobe.ts\"" >&2
  exit 1
fi
OUT=scripts/cabinetos-check/.cache
A=$COS/scripts/social/app
mkdir -p "$OUT"
ESBUILD=${ESBUILD:-$( [ -x /opt/npm-tools/node_modules/esbuild/bin/esbuild ] && echo /opt/npm-tools/node_modules/esbuild/bin/esbuild || echo "npx --yes esbuild" )}
$ESBUILD scripts/cabinetos-check/check.ts --bundle --platform=node --format=esm --outfile=$OUT/check.mjs --jsx=automatic --log-level=error \
  --alias:cos=$COS/src --resolve-extensions=.ts,.tsx,.js,.mjs,.json \
  --define:process.env.NODE_ENV=\"production\" --define:process.env.NEXT_PUBLIC_SUPABASE_URL=\"http://x\" \
  --define:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\"x\" --define:process.env.NEXT_PUBLIC_SITE_URL=\"http://x\" \
  --loader:.png=dataurl --loader:.svg=dataurl --loader:.woff2=dataurl --loader:.jpg=dataurl --loader:.webp=dataurl --loader:.css=empty \
  --alias:next/navigation=$A/nav.ts --alias:next/dynamic=$A/dyn.tsx --alias:next/link=$A/link.tsx \
  --alias:next/image=$A/img.tsx --alias:@/lib/supabase/client=$A/supa.ts \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
node $OUT/check.mjs
