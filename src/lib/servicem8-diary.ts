import { sm8Base, sm8Call, sm8List, sm8Str as str, Sm8Error, statusError, tidy, type Sm8Row as Row } from './servicem8';
import { jobMail, NOTE_HEAD, stampOf, TEXT_NOTE_HEAD } from './servicem8-mail';

/* A job's notes and its whole diary in ServiceM8, for the Job Kit's job screen (Current jobs, the job: Notes and Job
   diary; Raf, 23 Oct 2026: "notes card where i can add notes, saved automatically in servicem8 ... read whole diary
   from job card"). Behind the PIN through /api/job-kit/sm8.
   - Notes: a note is ServiceM8's own note record on the job (note.json, related_object job). The phone makes the
     note's uuid, so the first save creates it with that uuid and every later save (while Raf keeps typing) updates
     the same record: one entry in the job's diary, not one per pause. A retry of the first save gets 409 (already
     there) and becomes an update.
   - The diary: notes, attachments (photos and files), emails and texts (src/lib/servicem8-mail.ts) and the job's
     activities (bookings, and check-ins where ServiceM8 recorded the time). Payments and the job's own dates come
     from the job the phone already has. ServiceM8 keeps no history of status changes, so those aren't in it.
   ServiceM8 doesn't publish every field of these records, so each is read from the likely names (create_date,
   timestamp, edit_date) and a part that can't be read leaves a gap (`missing`) rather than failing the rest.
   Customer details only travel phone <-> this server <-> ServiceM8. */

export type JobNote = { uuid: string; text: string; at: string | null; edited: string | null };
export type DiaryFile = { uuid: string; name: string; photo: boolean };
export type DiaryKind = 'note' | 'file' | 'email' | 'sms' | 'visit' | 'checkin';
export type DiaryEntry = {
  id: string;
  kind: DiaryKind;
  at: string | null; // London time, "YYYY-MM-DDTHH:MM"
  text?: string; // a note, or the message's new part
  subject?: string;
  dir?: 'in' | 'out';
  copy?: boolean; // a message kept as a note copy (ServiceM8 won't let this account read emails or texts)
  end?: string | null; // a booking's or check-in's end
  staff?: string; // the staff uuid on a booking
  file?: DiaryFile;
};
export type Missing = 'notes' | 'files' | 'messages' | 'bookings';
export type JobDiary = { entries: DiaryEntry[]; missing: Missing[] };

const MAX_TEXT = 4000;
const newest = (a: { at: string | null }, b: { at: string | null }) => (b.at ?? '').localeCompare(a.at ?? '');
const isCopy = (note: string) => note.startsWith(NOTE_HEAD) || note.startsWith(TEXT_NOTE_HEAD);
const on = (v: unknown) => v === 1 || v === '1' || v === true;

/* Rows of one kind on this job: asked for with the job in the filter; if ServiceM8 turns that filter down, the
   same without `active` (and archived ones picked out here). Never the whole account's attachments. */
async function onJob(path: string, field: string, job: string): Promise<Row[]> {
  try {
    return await sm8List(path, `active eq 1 and ${field} eq '${job}'`);
  } catch (e) {
    if (!(e instanceof Sm8Error) || e.code !== 'sm8-error') throw e;
    return (await sm8List(path, `${field} eq '${job}'`)).filter((r) => str(r.active) !== '0');
  }
}

const noteAt = (n: Row) => stampOf(n.create_date) ?? stampOf(n.timestamp) ?? stampOf(n.date) ?? stampOf(n.edit_date);
function noteOf(n: Row): JobNote | null {
  const text = str(n.note).replace(/\r\n?/g, '\n');
  if (!str(n.uuid) || !text || isCopy(text)) return null;
  return { uuid: str(n.uuid), text: text.slice(0, MAX_TEXT * 2), at: noteAt(n), edited: stampOf(n.edit_date) };
}

/* The job's notes, newest first (the copies of emails and texts sent from the Job Kit left out: they're messages). */
export async function jobNotes(job: string): Promise<JobNote[]> {
  return (await onJob('note.json', 'related_object_uuid', job))
    .map(noteOf)
    .filter((n): n is JobNote => n !== null)
    .sort(newest);
}

/* Saves Raf's note: created with the phone's uuid the first time, updated after that. */
export async function saveJobNote(job: string, uuid: string, text: string, isNew: boolean) {
  const note = tidy(text).trim();
  if (isNew) {
    try {
      await sm8Call('note.json', { method: 'POST', body: { uuid, related_object: 'job', related_object_uuid: job, note } });
      return;
    } catch (e) {
      if (!(e instanceof Sm8Error && e.detail.startsWith('409'))) throw e; // already there from an earlier try
    }
  }
  await sm8Call(`note/${uuid}.json`, { method: 'POST', body: { note } });
}

const PHOTO = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
function fileOf(a: Row): DiaryEntry | null {
  const uuid = str(a.uuid);
  if (!uuid) return null;
  const type = str(a.file_type).toLowerCase();
  const name = str(a.attachment_name) || `File${type.startsWith('.') ? type : ''}`;
  const photo = PHOTO.test(type.startsWith('.') ? type : `.${type}`) || PHOTO.test(name) || Number(a.photo_width) > 0;
  return { id: `file-${uuid}`, kind: 'file', at: stampOf(a.timestamp) ?? stampOf(a.create_date) ?? stampOf(a.edit_date), file: { uuid, name, photo } };
}

/* Bookings (scheduled) and check-ins (recorded: the time ServiceM8's app logged on site). Others (travel and the
   like that ServiceM8 adds by itself) are left out. */
function activityOf(a: Row): DiaryEntry | null {
  const start = stampOf(a.start_date);
  const uuid = str(a.uuid);
  if (!uuid || !start) return null;
  const end = stampOf(a.end_date);
  const kind = on(a.activity_was_recorded) ? 'checkin' : on(a.activity_was_scheduled) ? 'visit' : null;
  if (!kind) return null;
  return { id: `act-${uuid}`, kind, at: start, end: end && end > start ? end : null, staff: str(a.staff_uuid) || undefined };
}

/* The whole diary, newest first. `email` and `mobile` are the job's, to tell their messages from Raf's. */
export async function jobDiary(job: string, email = '', mobile = ''): Promise<JobDiary> {
  const [notes, files, mails, acts] = await Promise.allSettled([
    jobNotes(job),
    onJob('attachment.json', 'related_object_uuid', job),
    jobMail(job, email, mobile),
    onJob('jobactivity.json', 'job_uuid', job),
  ]);
  const all = [notes, files, mails, acts];
  // A key ServiceM8 turned down, or nothing at all could be read: say why instead of an empty diary.
  const keyProblem = all.find((r) => r.status === 'rejected' && r.reason instanceof Sm8Error && r.reason.code === 'sm8-key');
  if (keyProblem?.status === 'rejected') throw keyProblem.reason;
  const failed = all.find((r) => r.status === 'rejected');
  if (all.every((r) => r.status === 'rejected') && failed?.status === 'rejected') throw failed.reason;
  const missing: Missing[] = [];
  const entries: DiaryEntry[] = [];
  if (notes.status === 'fulfilled') entries.push(...notes.value.map((n): DiaryEntry => ({ id: `note-${n.uuid}`, kind: 'note', at: n.at, text: n.text })));
  else missing.push('notes');
  if (files.status === 'fulfilled') entries.push(...files.value.map(fileOf).filter((x): x is DiaryEntry => x !== null));
  else missing.push('files');
  if (mails.status === 'fulfilled') {
    entries.push(
      ...mails.value.mails.map(
        (m): DiaryEntry => ({
          id: `msg-${m.id}`,
          kind: m.via === 'sms' ? 'sms' : 'email',
          at: m.at,
          dir: m.dir,
          subject: m.subject || undefined,
          text: (m.text || m.full).slice(0, MAX_TEXT),
          copy: m.copy || undefined,
        }),
      ),
    );
    if (!mails.value.readable && !mails.value.mails.length) missing.push('messages');
  } else missing.push('messages');
  if (acts.status === 'fulfilled') entries.push(...acts.value.map(activityOf).filter((x): x is DiaryEntry => x !== null));
  else missing.push('bookings');
  return { entries: entries.sort(newest), missing };
}

/* ---------- an attachment's file, for the phone to show ----------
   GET /attachment/<uuid>.file answers with the bytes (ServiceM8 may hand it over from its file storage, so the
   redirect is followed). thumb: photos made small (400 px JPEG) for the diary's grid; anything else isn't a photo.
   full: photos over 2.5 MB (or HEIC) made 2000 px JPEG, since a Vercel answer can't be over 4.5 MB; other files go
   as they are up to 4 MB. */
export class FileProblem extends Error {
  constructor(public code: 'not-photo' | 'too-big', public status: number) {
    super(code);
  }
}

function sniff(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  const box = String.fromCharCode(...b.slice(4, 12));
  if (/^ftyp(heic|heix|hevc|mif1|msf1)/.test(box)) return 'image/heic';
  return 'application/octet-stream';
}

export async function attachmentFile(uuid: string, size: 'thumb' | 'full'): Promise<{ bytes: Uint8Array; type: string }> {
  let res: Response;
  try {
    res = await fetch(`${sm8Base()}/attachment/${uuid}.file`, {
      headers: { 'X-API-Key': process.env.SERVICEM8_API_KEY ?? '' },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Sm8Error('sm8-down', 502);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw statusError(res.status, text.replace(/\s+/g, ' ').slice(0, 240));
  }
  if (Number(res.headers.get('content-length') ?? 0) > 30_000_000) throw new FileProblem('too-big', 413);
  let bytes = new Uint8Array(await res.arrayBuffer());
  const type = sniff(bytes);
  const image = type.startsWith('image/');
  if (size === 'thumb') {
    if (!image) throw new FileProblem('not-photo', 415);
    try {
      const sharp = (await import('sharp')).default;
      return { bytes: new Uint8Array(await sharp(bytes).rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer()), type: 'image/jpeg' };
    } catch {
      // can't be made smaller here (HEIC on some servers): send it as it is if it's small, else a file tile
      if (bytes.length > 600_000 || type === 'image/heic') throw new FileProblem('not-photo', 415);
      return { bytes, type };
    }
  }
  if (image && (bytes.length > 2_500_000 || type === 'image/heic')) {
    try {
      const sharp = (await import('sharp')).default;
      bytes = new Uint8Array(await sharp(bytes).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer());
      return { bytes, type: 'image/jpeg' };
    } catch {
      /* sent as it is below if it fits */
    }
  }
  if (bytes.length > 4_000_000) throw new FileProblem('too-big', 413);
  return { bytes, type };
}
