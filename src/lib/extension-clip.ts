/* CabinetOS Units, my extension for SketchUp, as a short silent loop (28 Oct 2026, Raf: 'the cabinetos extension in
   SketchUp should be more prominent and more visual and be seen'): an angled unit under a slope, a 1000 wardrobe and an
   800 chest of drawers build themselves board by board from the extension's own parts, the doors shut, then the
   wardrobe opens and a drawer comes out. Made by scripts/sketchup-extension/clip.cjs (needs ../cabinetos-site); each
   loop starts on its still, so the still and the video line up. New names whenever they're made again. */
export const EXTENSION_HREF = '/sketchup#extension';
export const EXTENSION_PAGE = 'https://www.cabinetos.co.uk/sketchup-extension';

const DIR = '/images/sketchup/extension';
export const EXTENSION_STILL = `${DIR}/build-tall-32af49ae.jpg`; // 960 x 1020
export const EXTENSION_CLIP = { mp4: `${DIR}/build-tall-32af49ae.mp4`, webm: `${DIR}/build-tall-32af49ae.webm` };
export const EXTENSION_STILL_SQUARE = `${DIR}/build-square-327713fd.jpg`; // 720 x 720
export const EXTENSION_CLIP_SQUARE = { mp4: `${DIR}/build-square-327713fd.mp4`, webm: `${DIR}/build-square-327713fd.webm` };
export const EXTENSION_STILL_WIDE = `${DIR}/build-wide-0895f01f.jpg`; // 960 x 720
export const EXTENSION_CLIP_WIDE = { mp4: `${DIR}/build-wide-0895f01f.mp4`, webm: `${DIR}/build-wide-0895f01f.webm` };

export const EXTENSION_ALT =
  'Drawn by my SketchUp extension, board by board: a 700 unit under a slope, a 1000 wardrobe with its doors open and an 800 chest of drawers with a drawer out';
