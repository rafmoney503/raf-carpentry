import { attachment, mailFiles, mailsFrom } from './outlook';
import { attachFile, sm8List, sm8Str as str, Sm8Error, touchJob } from './servicem8';
import { stableUuid } from './brief-token';
import { jpegOf } from './photo-jpeg';

/* Photos a customer emailed to info@rafcarpentry.com, onto their ServiceM8 job. Raf, 8 Nov 2026: a customer 'apparently
   send pictures aswell and I don't see it'. A job made with New enquiry from this email took the words only, so the
   photos stayed in Outlook and never reached the job's diary in ServiceM8 (photos sent to ServiceM8's own job email
   do arrive there). This finds the photos in their newest emails to info@ (any folder), says which are on the job
   already, and puts the rest on it: each made a 2400 px JPEG (upright, no GPS or other hidden data), named
   'Email - IMG_4821.jpg', with a ServiceM8 uuid made from the job, the photo's name and its size, so the same photo
   twice (a second tap, the same photo in a forwarded email) is one attachment: ServiceM8 answers 409.
   What counts as a photo: an image (JPEG, PNG, HEIC, WebP) of 60 KB or more, so an email signature's logos and
   icons (a few KB) are left out. */

export type MailPhoto = { mail: string; att: string; name: string; size: number; at: string; uuid: string; onJob: boolean };

const MAILS = 6; // their newest emails looked through
const MAX_PHOTOS = 24;
const MIN_BYTES = 60_000;
const IMAGE = /^image\/(jpe?g|pjpeg|png|heic|heif|webp)$/i;
const IMAGE_NAME = /\.(jpe?g|png|heic|heif|webp)$/i;

export const photoUuid = (job: string, name: string, size: number) => stableUuid(`${job}:mailphoto:${name.trim().toLowerCase()}:${size}`);

async function onJobUuids(job: string): Promise<Set<string>> {
  let rows;
  try {
    rows = await sm8List('attachment.json', `active eq 1 and related_object_uuid eq '${job}'`);
  } catch (e) {
    if (!(e instanceof Sm8Error) || e.code !== 'sm8-error') throw e;
    rows = (await sm8List('attachment.json', `related_object_uuid eq '${job}'`)).filter((r) => str(r.active) !== '0');
  }
  return new Set(rows.map((r) => str(r.uuid).toLowerCase()).filter(Boolean));
}

/* Their photos, newest email first. `mail` keeps it to one email (the one a new enquiry was made from). */
export async function emailPhotos(job: string, email: string, mail = ''): Promise<MailPhoto[]> {
  const mails = mail ? [{ id: mail, at: '' }] : (await mailsFrom(email, 10)).filter((m) => !m.mine).slice(0, MAILS);
  const [lists, there] = await Promise.all([Promise.all(mails.map((m) => mailFiles(m.id).catch(() => []))), onJobUuids(job)]);
  const out: MailPhoto[] = [];
  const seen = new Set<string>();
  mails.forEach((m, i) => {
    for (const f of lists[i]) {
      if (!(IMAGE.test(f.type) || IMAGE_NAME.test(f.name)) || f.size < MIN_BYTES) continue;
      const uuid = photoUuid(job, f.name, f.size);
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      out.push({ mail: m.id, att: f.id, name: f.name, size: f.size, at: m.at, uuid, onJob: there.has(uuid) });
    }
  });
  return out.slice(0, MAX_PHOTOS);
}

const nameFor = (original: string) =>
  `Email - ${
    original
      .replace(/\.[A-Za-z0-9]{2,5}$/, '')
      .replace(/[^\w .()-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 70) || 'photo'
  }.jpg`;

/* Puts the ones not on the job yet onto it, two at a time; then the job is saved again so ServiceM8 shows them in
   its diary. One that can't be read or sent is counted, not fatal. */
export async function addEmailPhotos(job: string, email: string, mail = ''): Promise<{ added: number; there: number; failed: number; photos: MailPhoto[] }> {
  const photos = await emailPhotos(job, email, mail);
  const todo = photos.filter((p) => !p.onJob);
  let added = 0;
  let there = photos.length - todo.length;
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, todo.length) }, async () => {
      while (next < todo.length) {
        const p = todo[next++];
        try {
          const f = await attachment(p.mail, p.att);
          const jpeg = await jpegOf(f.bytes, 2400, 85);
          const r = await attachFile(job, new Blob([jpeg as BlobPart], { type: 'image/jpeg' }), nameFor(p.name), p.uuid);
          if (r.existed) there++;
          else added++;
          p.onJob = true;
        } catch {
          failed++;
        }
      }
    }),
  );
  if (added) await touchJob(job);
  return { added, there, failed, photos };
}
