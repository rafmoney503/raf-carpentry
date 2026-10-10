/* Photos are made smaller on the phone before they are kept or sent: 2400 px on the long side,
   JPEG, about 0.5 to 1 MB instead of 3 to 5 MB. Redrawing the picture also drops its hidden data
   (GPS, phone model), so nothing of the client's address goes out. Clips are sent as they are. */

const LONG = 2400;
const THUMB = 240;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This photo could not be opened.'));
    };
    img.src = url;
  });
}

function draw(src: CanvasImageSource, w: number, h: number, long: number) {
  const k = Math.min(1, long / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  if (!g) throw new Error('No canvas');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, cw, ch);
  return c;
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo.'))), 'image/jpeg', q));

export async function shrinkPhoto(file: Blob) {
  const img = await loadImage(file);
  try {
    // naturalWidth/Height already follow the phone's rotation in current browsers.
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const big = draw(img, w, h, LONG);
    const blob = await toBlob(big, 0.86);
    const thumb = draw(big, big.width, big.height, THUMB).toDataURL('image/jpeg', 0.72);
    const size = { w: big.width, h: big.height };
    big.width = big.height = 0; // let iOS have the memory back
    return { blob, ...size, thumb };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/* Length, size and a still for a clip. Gives up on the still after a few seconds (some phones
   will not draw a frame of a clip that has not played); the clip is still kept and sent. */
export function clipInfo(file: Blob): Promise<{ duration?: number; w?: number; h?: number; thumb?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    let done = false;
    const finish = (thumb?: string) => {
      if (done) return;
      done = true;
      const out = {
        duration: Number.isFinite(v.duration) ? v.duration : undefined,
        w: v.videoWidth || undefined,
        h: v.videoHeight || undefined,
        thumb,
      };
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      resolve(out);
    };
    const timer = setTimeout(() => finish(), 6000);
    v.onloadedmetadata = () => {
      try {
        v.currentTime = Math.min(0.6, (v.duration || 1) / 3);
      } catch {
        /* some browsers refuse to seek before data */
      }
    };
    v.onseeked = () => {
      try {
        const c = draw(v, v.videoWidth, v.videoHeight, THUMB);
        clearTimeout(timer);
        finish(c.toDataURL('image/jpeg', 0.72));
      } catch {
        clearTimeout(timer);
        finish();
      }
    };
    v.onerror = () => {
      clearTimeout(timer);
      finish();
    };
    v.src = url;
  });
}
