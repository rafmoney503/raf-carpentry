import 'server-only';
import webpush from 'web-push';
import { hqApi, type PushSub } from './db';

/* Web Push to the phones that turned the morning summary on (Alerts). VAPID keys: HQ_VAPID_PUBLIC and
   HQ_VAPID_PRIVATE. On an iPhone it only works once HQ is on the Home Screen. */

export function pushReady(): boolean {
  return Boolean(process.env.HQ_VAPID_PUBLIC && process.env.HQ_VAPID_PRIVATE);
}

let set = false;
function setup() {
  if (set) return;
  webpush.setVapidDetails('mailto:info@rafcarpentry.com', process.env.HQ_VAPID_PUBLIC!, process.env.HQ_VAPID_PRIVATE!);
  set = true;
}

export type Note = { title: string; body: string; url?: string; tag?: string };

/* Sends each note to each phone; a phone that has gone away is marked so in Supabase. */
export async function sendTo(subs: PushSub[], notes: Note[]): Promise<{ sent: number; failed: number }> {
  setup();
  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    let ok = true;
    let gone = false;
    for (const n of notes) {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify(n), { TTL: 6 * 3600, urgency: 'normal' });
      } catch (e) {
        ok = false;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone = true;
        break;
      }
    }
    if (ok) sent++;
    else failed++;
    await hqApi('push_result', { endpoint: s.endpoint, ok, gone }).catch(() => {});
  }
  return { sent, failed };
}
