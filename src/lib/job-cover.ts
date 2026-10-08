import { getImageProps } from 'next/image';
import { preload } from 'react-dom';

/* The main photo on a job page: its `sizes`, shared with the cards that link to it, so a card can
   start loading exactly the file the job page will show (the photo grows from card to page). */
export const JOB_COVER_SIZES = '(max-width: 768px) 100vw, 700px';

const started = new Set<string>();
export function preloadJobCover(src: string) {
  if (started.has(src)) return;
  started.add(src);
  const { props } = getImageProps({ src, alt: '', fill: true, sizes: JOB_COVER_SIZES });
  preload(props.src, { as: 'image', imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: 'high' });
}
