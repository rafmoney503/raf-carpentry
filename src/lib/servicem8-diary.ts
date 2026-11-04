import { sm8Base, sm8Call, sm8List, sm8Str as str, Sm8Error, statusError, tidy, type Sm8Row as Row } from './servicem8';
import { fileRefs, jobMail, NOTE_HEAD, stampOf, TEXT_NOTE_HEAD, type FileRef, type Mail, type RowSeen } from './servicem8-mail';
import { photoKey, photoMarks } from './mail-text';
import { jpegOf, sniff } from './photo-jpeg';

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
  of?: string; // on a file: the message it came with (that entry's id, "msg-<uuid>")
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

/* A photo by its type (".jpg", "jpg" or "image/jpeg"), its name, or the size ServiceM8 noted. A file named with
   no type at all ("IMG_4824") is tried as a photo too: if it isn't one, the phone shows it as a file. */
const PHOTO = /(^|[./])(jpe?g|png|gif|webp|heic|heif|hei[cf]s|avif|tiff?)$/i;
const NOT_PHOTO = /(^|[./])(pdf|docx?|xlsx?|csv|txt|rtf|pages|numbers|key|zip|mov|mp4|m4v|mp3|m4a|wav|eml|msg|skp|dwg|dxf)$/i;
function fileOf(a: Row): DiaryEntry | null {
  const uuid = str(a.uuid);
  if (!uuid || str(a.active) === '0') return null;
  const type = str(a.file_type).toLowerCase().trim();
  const name = str(a.attachment_name) || `File${type.startsWith('.') ? type : ''}`;
  const typed = type.replace(/^\./, '');
  const unknown = !typed && !/\.[a-z0-9]{2,5}$/i.test(name);
  const photo = PHOTO.test(typed) || PHOTO.test(name) || Number(a.photo_width) > 0 || (unknown && !NOT_PHOTO.test(name));
  return { id: `file-${uuid}`, kind: 'file', at: stampOf(a.timestamp) ?? stampOf(a.create_date) ?? stampOf(a.edit_date), file: { uuid, name, photo } };
}

/* The job's photos, oldest first (the brief's own photos come first), for the Job Kit's Quotes: the ones filed on
   the job and the ones that came with the customer's emails and texts (messageFiles). */
export async function jobPhotos(job: string): Promise<{ uuid: string; name: string; at: string | null }[]> {
  const [own, mails] = await Promise.all([onJob('attachment.json', 'related_object_uuid', job), jobMail(job).catch(() => null)]);
  const files = own.map(fileOf).filter((e): e is DiaryEntry => e !== null);
  if (mails) files.push(...(await messageFiles(mails.mails, files)).added);
  return files
    .filter((e) => Boolean(e.file?.photo))
    .map((e) => ({ uuid: e.file!.uuid, name: e.file!.name, at: e.at }))
    .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
}

/* ---------- photos and files that came with a message ----------
   ServiceM8 shows a customer's emailed (or texted) photos under their message in the job's diary, but the API
   doesn't say where it keeps them, and they needn't be filed on the job: Raf, 4 Nov 2026, "i still don't see some
   pictures being shown in service m8 ... like becki ponting message not showing in diary pictures". So for their
   newest messages (MESSAGES_ASKED) this asks for the attachments filed on each message (related_object_uuid = the
   message's uuid, whatever ServiceM8 calls the kind), and looks up one by one (REFS_ASKED) any attachment the
   message's record points to (fileRefs). Each one found says which message it came with (`of`), and a file that is
   on the job as well is marked rather than shown twice. Three asked at a time; one that fails is skipped. */
const MESSAGES_ASKED = 12;
const REFS_ASKED = 12;
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function threeAtATime<T, R>(items: T[], work: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await work(items[i]);
      }
    }),
  );
  return out;
}

const refEntry = (ref: FileRef, row: Row | undefined): DiaryEntry | null => {
  if (row) return fileOf(row);
  // the record named it but ServiceM8 wouldn't hand over the attachment's record: only a file with a name is shown
  const name = ref.name ?? '';
  if (!name) return null;
  const type = (ref.type ?? '').toLowerCase();
  return fileOf({ uuid: ref.uuid, attachment_name: name, file_type: /^\.?[a-z0-9]{2,5}$/.test(type) ? type : '' });
};

export async function messageFiles(mails: Mail[], onJobFiles: DiaryEntry[]): Promise<{ added: DiaryEntry[]; asked: number; refs: number }> {
  const known = new Map(onJobFiles.filter((e) => e.file).map((e) => [e.file!.uuid.toLowerCase(), e]));
  const added = new Map<string, DiaryEntry>();
  const put = (e: DiaryEntry | null, m: Mail) => {
    if (!e?.file) return;
    const k = e.file.uuid.toLowerCase();
    const of = `msg-${m.id}`;
    const there = known.get(k);
    if (there) {
      there.of ??= of;
      return;
    }
    if (!added.has(k)) added.set(k, { ...e, of, at: e.at ?? m.at });
  };
  // theirs first (newest first), then Raf's to make up the number: a message whose direction ServiceM8 didn't say is
  // read as his, and his own emails can carry files too (a quote's PDF)
  const real = mails.filter((m) => !m.copy && isUuid(m.id)).reverse();
  const theirs = [...real.filter((m) => m.dir === 'in'), ...real.filter((m) => m.dir !== 'in')].slice(0, MESSAGES_ASKED);
  const filed = await threeAtATime(theirs, (m) => onJob('attachment.json', 'related_object_uuid', m.id).catch((): Row[] => []));
  theirs.forEach((m, i) => filed[i].forEach((a) => put(fileOf(a), m)));
  // attachments a record points to, newest messages first
  const refs: { ref: FileRef; m: Mail }[] = [];
  for (const m of [...mails].reverse()) for (const ref of m.files ?? []) if (!known.has(ref.uuid) && !added.has(ref.uuid) && !refs.some((x) => x.ref.uuid === ref.uuid)) refs.push({ ref, m });
  const rows = await threeAtATime(refs.slice(0, REFS_ASKED), ({ ref }) =>
    sm8Call(`attachment/${ref.uuid}.json`)
      .then((r) => (Array.isArray(r.data) ? (r.data[0] as Row) : (r.data as Row)))
      .catch((): Row | undefined => undefined),
  );
  refs.slice(0, REFS_ASKED).forEach((x, i) => put(refEntry(x.ref, rows[i] && str(rows[i]!.uuid) ? rows[i] : undefined), x.m));
  return { added: [...added.values()], asked: theirs.length, refs: Math.min(refs.length, REFS_ASKED) };
}

/* What a diary's messages and attachments looked like, for Vercel's logs when a customer's message names photos
   the diary couldn't find, or has a field that looks like attachments: the record's field names, the shape of
   those fields, and where the job's attachments are filed. Field names, kinds and counts only: never a value, a
   name or an address. Until ServiceM8 says where it keeps emailed photos. */
type Seen = { kind: 'email' | 'sms'; mail: Mail; row: Row };
const shapeOf = (v: unknown): string =>
  v === null || v === undefined
    ? 'null'
    : Array.isArray(v)
      ? `array(${v.length})${v.length && typeof v[0] === 'object' && v[0] ? `{${Object.keys(v[0] as object).slice(0, 12).join(',')}}` : v.length ? `<${typeof v[0]}>` : ''}`
      : typeof v === 'object'
        ? `{${Object.keys(v as object).slice(0, 12).join(',')}}`
        : typeof v === 'string'
          ? `string(${v.length}${(v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []).length ? `, ${(v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []).length} uuid` : ''})`
          : typeof v;
function logPhotos(job: string, seen: Seen[], jobFiles: Row[], entries: DiaryEntry[], got: { asked: number; refs: number }) {
  const found = new Set(entries.filter((e) => e.kind === 'file' && e.file).map((e) => photoKey(e.file!.name)));
  const theirs = seen.filter((x) => x.mail.dir === 'in' && !x.mail.copy);
  const missing = theirs.filter((x) => photoMarks(`${x.mail.text}\n${x.mail.full}`).photos.some((n) => !found.has(photoKey(n))));
  const refLike = theirs.filter((x) => Object.keys(x.row).some((k) => REF_LIKE.test(k)));
  if (!missing.length && !refLike.length) return;
  const sample = (missing[0] ?? refLike[0]).row;
  const count = (rows: Row[], k: string) => {
    const m: Record<string, number> = {};
    for (const r of rows) m[str(r[k]) || '-'] = (m[str(r[k]) || '-'] ?? 0) + 1;
    return m;
  };
  console.log(
    '[diary-photos]',
    JSON.stringify({
      job: job.slice(0, 8),
      messages: theirs.length,
      missing: missing.length,
      asked: got.asked,
      refs: got.refs,
      fromMessages: entries.filter((e) => e.kind === 'file' && e.of).length,
      jobFiles: jobFiles.length,
      jobFilesFiled: count(jobFiles, 'related_object'),
      jobFilesSource: count(jobFiles, 'attachment_source'),
      jobFilesClass: count(jobFiles, 'class_name'),
      kind: (missing[0] ?? refLike[0]).kind,
      fields: Object.keys(sample).slice(0, 60),
      shapes: shapesOf(sample),
      ...(refLike[0] && refLike[0].row !== sample ? { refFields: Object.keys(refLike[0].row).slice(0, 60), refShapes: shapesOf(refLike[0].row) } : {}),
    }),
  );
}
const REF_LIKE = /attach|photo|image|picture|media|file/i;
const shapesOf = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => REF_LIKE.test(k) || /related|regarding|object/i.test(k)).map(([k, v]) => [k, shapeOf(v)]));

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
  const seen: Seen[] = [];
  const onRow: RowSeen = (kind, mail, row) => seen.push({ kind, mail, row });
  const [notes, files, mails, acts] = await Promise.allSettled([
    jobNotes(job),
    onJob('attachment.json', 'related_object_uuid', job),
    jobMail(job, email, mobile, onRow),
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
  const jobFiles = files.status === 'fulfilled' ? files.value.map(fileOf).filter((x): x is DiaryEntry => x !== null) : [];
  if (files.status === 'fulfilled') entries.push(...jobFiles);
  else missing.push('files');
  // the photos and files that came with their messages (not always filed on the job itself)
  let got = { asked: 0, refs: 0 };
  if (mails.status === 'fulfilled' && mails.value.mails.length) {
    const more = await messageFiles(mails.value.mails, jobFiles).catch(() => ({ added: [] as DiaryEntry[], asked: 0, refs: 0 }));
    entries.push(...more.added);
    got = more;
  }
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
  try {
    logPhotos(job, seen, files.status === 'fulfilled' ? files.value : [], entries, got);
  } catch {
    /* only a log line */
  }
  return { entries: entries.sort(newest), missing };
}

/* ---------- an attachment's file, for the phone to show ----------
   GET /attachment/<uuid>.file answers with the bytes (ServiceM8 may hand it over from its file storage, so the
   redirect is followed). thumb: photos made small (400 px JPEG) for the diary's grid; anything else isn't a photo.
   full: photos over 2.5 MB, and every HEIC or TIFF (most browsers can't show them), made 2000 px JPEG, since a
   Vercel answer can't be over 4.5 MB; other files go as they are up to 4 MB. iPhone photos (HEIC) are read by
   src/lib/photo-jpeg.ts; until 3 Nov 2026 they showed as their file name ('IMG_4821.HEIC'). Photos are made two
   at a time on one server, so a page of HEIC thumbnails doesn't take all its memory at once. */
export class FileProblem extends Error {
  constructor(public code: 'not-photo' | 'too-big', public status: number) {
    super(code);
  }
}

let making = 0;
const waiting: (() => void)[] = [];
async function twoAtATime<T>(work: () => Promise<T>): Promise<T> {
  if (making >= 2) await new Promise<void>((go) => waiting.push(go));
  making++;
  try {
    return await work();
  } finally {
    making--;
    waiting.shift()?.();
  }
}

const SHOWN_AS_IS = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

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
  const bytes = new Uint8Array(await res.arrayBuffer());
  const type = sniff(bytes);
  const image = type.startsWith('image/');
  if (size === 'thumb') {
    if (!image) throw new FileProblem('not-photo', 415);
    try {
      return { bytes: await twoAtATime(() => jpegOf(bytes, 400, 70)), type: 'image/jpeg' };
    } catch {
      // can't be read here: a small browser-ready photo goes as it is, anything else is a file tile
      if (bytes.length > 600_000 || !SHOWN_AS_IS.has(type)) throw new FileProblem('not-photo', 415);
      return { bytes, type };
    }
  }
  if (image && (bytes.length > 2_500_000 || !SHOWN_AS_IS.has(type))) {
    try {
      return { bytes: await twoAtATime(() => jpegOf(bytes, 2000, 80)), type: 'image/jpeg' };
    } catch {
      /* sent as it is below if it fits */
    }
  }
  if (bytes.length > 4_000_000) throw new FileProblem('too-big', 413);
  return { bytes, type };
}
