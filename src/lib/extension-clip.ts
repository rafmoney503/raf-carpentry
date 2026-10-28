/* CabinetOS Units, my extension for SketchUp, as a short silent loop (28 Oct 2026, Raf: 'the cabinetos extension in
   SketchUp should be more prominent and more visual and be seen'): an angled unit under a slope, a 1000 wardrobe and an
   800 chest of drawers build themselves board by board from the extension's own parts, the doors shut, the angled
   unit's two doors fold open and shut together (the small one is hinged to the big one: scripts/sketchup-extension/
   fold.cjs), then the wardrobe opens and a drawer comes out. Made by scripts/sketchup-extension/clip.cjs (needs
   ../cabinetos-site); each loop starts on its still, so the still and the video line up. New names whenever they're
   made again. */
export const EXTENSION_HREF = '/sketchup#extension';
export const EXTENSION_PAGE = 'https://www.cabinetos.co.uk/sketchup-extension';

const DIR = '/images/sketchup/extension';
export const EXTENSION_STILL = `${DIR}/build-tall-87408bf7.jpg`; // 960 x 1048
export const EXTENSION_CLIP = { mp4: `${DIR}/build-tall-87408bf7.mp4`, webm: `${DIR}/build-tall-87408bf7.webm` };
export const EXTENSION_STILL_SQUARE = `${DIR}/build-square-a568dfad.jpg`; // 720 x 720
export const EXTENSION_CLIP_SQUARE = { mp4: `${DIR}/build-square-a568dfad.mp4`, webm: `${DIR}/build-square-a568dfad.webm` };
export const EXTENSION_STILL_WIDE = `${DIR}/build-wide-202b1825.jpg`; // 960 x 720
export const EXTENSION_CLIP_WIDE = { mp4: `${DIR}/build-wide-202b1825.mp4`, webm: `${DIR}/build-wide-202b1825.webm` };

export const EXTENSION_ALT =
  'Drawn by my SketchUp extension, board by board: a 700 unit under a slope, a 1000 wardrobe with its doors open and an 800 chest of drawers with a drawer out';
