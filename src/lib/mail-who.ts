/* Who an email is from, for the Inbox screen (src/app/job-kit/inbox.tsx) and the assistant (src/lib/assistant.ts).
   Type imports only, so it runs on the phone and the server. */
import type { InboxMail, Who } from './outlook';

/* Who wrote it, for replies and matching: the Reply-To when there is one (ServiceM8's 'New brief' emails). */
export const replyWho = (m: Pick<InboxMail, 'from' | 'replyTo'>) => m.replyTo ?? m.from;

export const NO_REPLY = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|notifications?|alerts?|bounce)[@+.]/i;
export const noReply = (m: Pick<InboxMail, 'from' | 'replyTo'>) => NO_REPLY.test(replyWho(m).email);

/* A first name for "Hi Kasia,": the first word of a name with a surname ("Kasia Nowak"), or a one-word name the
   address starts with (Kasia, kasia.n@...), else from kasia.nowak@...; nothing for Screwfix, info@, sales@ and the like
   (a business sends from an address that isn't its name). */
export function firstOf(w: Who) {
  if (NO_REPLY.test(w.email)) return '';
  const words = w.name
    .replace(/["']/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/[\s,]+/)
    .filter((x) => x && !x.includes('@'));
  while (words.length > 2 && /^(mr|mrs|ms|miss|dr)\.?$/i.test(words[0])) words.shift();
  const local = w.email.split('@')[0] ?? '';
  const person = words.length >= 2 || (words.length === 1 && local.toLowerCase().startsWith(words[0].toLowerCase()));
  const fromName = person ? words[0] : '';
  const fromLocal = /[._-]/.test(local) ? (local.split(/[._-]/)[0] ?? '') : '';
  const pick = /^[A-Za-zÀ-ž][a-zà-ž'-]{1,}$/.test(fromName) ? fromName : !words.length && /^[a-z]{2,}$/i.test(fromLocal) ? fromLocal : '';
  if (!pick || /^(info|sales|hello|hi|admin|office|accounts?|support|team|contact|enquiries|orders?|service|the|mr|mrs|ms|dr)$/i.test(pick)) return '';
  return pick[0].toUpperCase() + pick.slice(1).toLowerCase();
}
