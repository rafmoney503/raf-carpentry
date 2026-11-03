/* Photos made into a JPEG on the server, iPhone photos (HEIC) included.
   sharp's prebuilt library reads JPEG, PNG, WebP, GIF, TIFF and AVIF but not HEIC (it has no HEVC decoder), and
   photos customers send from an iPhone arrive in ServiceM8 as HEIC, so the Job Kit's diary showed them as a file
   name (Raf, 3 Nov 2026: "i will be able to see the pictures send by customers right now says just img something").
   HEIC is decoded with libheif in WebAssembly (heic-decode), which turns it the right way up as the camera saved it,
   then sharp makes the JPEG. Everything else goes straight to sharp, turned by its EXIF orientation. */

export type Sniffed = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/heic' | 'image/avif' | 'image/tiff' | 'application/pdf' | 'application/octet-stream';

/* What a file is by its first bytes (names and ServiceM8's file_type aren't always right). */
export function sniff(b: Uint8Array): Sniffed {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return 'image/tiff';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  const box = String.fromCharCode(...b.slice(4, 12));
  if (/^ftyp(avif|avis)/.test(box)) return 'image/avif';
  if (/^ftyp(heic|heix|heim|heis|hevc|hevx|hevm|hevs|mif1|msf1)/.test(box)) return 'image/heic';
  return 'application/octet-stream';
}

const heifBrand = (b: Uint8Array) => /^ftyp(heic|heix|heim|heis|hevc|hevx|hevm|hevs|mif1|msf1)/.test(String.fromCharCode(...b.slice(4, 12)));

/* A JPEG no bigger than `edge` either way (never made bigger). Throws if the bytes aren't a photo it can read. */
export async function jpegOf(bytes: Uint8Array, edge: number, quality: number): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const fit = { width: edge, height: edge, fit: 'inside' as const, withoutEnlargement: true };
  try {
    return new Uint8Array(await sharp(bytes, { failOn: 'none' }).rotate().resize(fit).jpeg({ quality }).toBuffer());
  } catch (e) {
    if (!heifBrand(bytes)) throw e;
  }
  const decode = (await import('heic-decode')).default;
  const { width, height, data } = await decode({ buffer: bytes });
  const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(await sharp(raw, { raw: { width, height, channels: 4 } }).resize(fit).jpeg({ quality }).toBuffer());
}
