/* Pictures of the wardrobe planner (/wardrobe-planner): its own 3D view of the starting design (2800 x 2400, three
   900 sage classic shaker units, doors open), taken from the planner page with Playwright (selection box hidden). Used by
   src/components/PlannerTeaser.tsx and the Tools menu panel (src/lib/menu-panels.ts). If the planner's look changes,
   take them again and give the files new names so old copies aren't served from cache. */
export const PLANNER_HREF = '/wardrobe-planner';
export const PLANNER_IMAGE = '/images/tools/wardrobe-planner-525a18cc.jpg'; // 4:3, 1280 x 960, the clip's first frame
export const PLANNER_IMAGE_SQUARE = '/images/tools/wardrobe-planner-square-e4df2c75.jpg'; // 720 x 720, the clip's first frame
/* The same view as a 5 s silent loop, doors open and close (PlannerClip, 16 Oct 2026), made with the scratchpad's
   clip/clip.mjs (the planner on a fake clock, 25 frames a second) and clip/enc.sh (H.264 and VP9, no sound). The
   loop starts on an open frame, which is also the still, so the still and the video line up. */
export const PLANNER_CLIP_SQUARE = { mp4: '/images/tools/wardrobe-planner-loop-square-e4df2c75.mp4', webm: '/images/tools/wardrobe-planner-loop-square-e4df2c75.webm' }; // 480 x 480
export const PLANNER_CLIP = { mp4: '/images/tools/wardrobe-planner-loop-525a18cc.mp4', webm: '/images/tools/wardrobe-planner-loop-525a18cc.webm' }; // 960 x 720
export const PLANNER_ALT = 'The wardrobe planner in 3D: three sage green shaker units with the doors open, showing rails, shelves and drawers';
