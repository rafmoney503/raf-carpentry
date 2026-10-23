/* Talking to /api/job-kit/sm8 (ServiceM8, behind the PIN) from the Job Kit, and saying what went wrong in plain
   words. Shared by Current jobs (current.tsx) and a job's emails (mail.tsx). */

export const clock = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function post<T>(pin: string, body: Record<string, unknown>, path = '/api/job-kit/sm8'): Promise<{ ok: true; data: T } | { ok: false; error: string; detail?: string }> {
  if (!pin) return { ok: false, error: 'no-pin' };
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
    if (!res.ok) return { ok: false, error: data.error || 'sm8-error', detail: data.detail };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export function problemText(error?: string, detail?: string, at?: number) {
  switch (error) {
    case undefined:
      return '';
    case 'sm8-not-set-up':
      return 'ServiceM8 isn’t connected yet: SERVICEM8_API_KEY is missing in Vercel.';
    case 'sm8-key':
      return 'ServiceM8 turned the key down. Make a new key in ServiceM8 (Settings, API Keys, Full access) and replace SERVICEM8_API_KEY in Vercel.';
    case 'sm8-forbidden':
      return 'ServiceM8 says this key isn’t allowed to do that. Check the key has Full access and the plan is Starter or above.';
    case 'sm8-busy':
      return /quota/i.test(detail ?? '') ? 'ServiceM8 says today’s allowance of messages is used up. Try again tomorrow, or send it from ServiceM8.' : 'ServiceM8 is busy. Try again in a minute.';
    case 'sm8-gone':
      return 'ServiceM8 doesn’t have that customer any more (archived or merged there). Search again.';
    case 'ai-not-set-up':
      return 'Draft a reply isn’t switched on yet: ANTHROPIC_API_KEY is missing in Vercel.';
    case 'ai-key':
      return 'Claude turned the key down. Make a new key in the Claude Console and replace ANTHROPIC_API_KEY in Vercel.';
    case 'ai-limit':
      return 'The Claude account has reached its spending limit or run out of credit. Top it up or raise the limit in the Claude Console (Billing).';
    case 'ai-busy':
      return 'Claude is busy or didn’t answer. Try again in a minute, or write it yourself.';
    case 'ai-error':
      return `Claude couldn’t write a draft${detail ? `: ${detail}` : '.'} Write it yourself, or try again.`;
    case 'outlook-not-set-up':
      return `The Inbox isn’t connected yet${detail ? `: ${detail} ${detail.includes(',') ? 'are' : 'is'} missing in Vercel` : ''}.`;
    case 'outlook-secret':
      return detail === 'expired'
        ? 'The Microsoft secret has run out (they last 24 months at most). In Entra make a new one (Raf Job Kit, Certificates & secrets) and replace MS_CLIENT_SECRET in Vercel.'
        : 'Microsoft turned the secret down. MS_CLIENT_SECRET in Vercel needs the secret’s Value, not its Secret ID. If you can’t see the Value any more, make a new secret in Entra (Raf Job Kit, Certificates & secrets).';
    case 'outlook-app':
      return `Microsoft can’t find the Raf Job Kit app. MS_TENANT_ID and MS_CLIENT_ID in Vercel have to match the app’s Overview page in Entra.${detail ? ` (${detail})` : ''}`;
    case 'outlook-consent':
      return `Microsoft hasn’t let the Job Kit into the mailbox yet. In Entra: Raf Job Kit, API permissions, Mail.ReadWrite and Mail.Send as Application permissions, then Grant admin consent.${detail ? ` (${detail})` : ''}`;
    case 'outlook-mailbox':
      return `Microsoft can’t find the info@ mailbox from here.${detail ? ` (${detail})` : ''}`;
    case 'outlook-gone':
      return 'That email isn’t there any more: it was moved or deleted in Outlook. Go back and refresh the Inbox.';
    case 'outlook-busy':
      return `Microsoft is busy or didn’t answer. Try again in a minute.${/Drafts/.test(detail ?? '') ? ' It wasn’t sent: your reply is in Drafts in Outlook, so send it from there (or delete that draft and send again here).' : ''}`;
    case 'outlook-too-big':
      return 'This one is too big to show here: open it in Outlook.';
    case 'outlook-error':
      return `Microsoft sent back an error${detail ? `: ${detail}` : '.'}${/Drafts/.test(detail ?? '') ? ' Your reply is in Drafts in Outlook.' : ''}`;
    case 'too-big':
      return 'Over 4 MB, too big to send from here. Add it to the job in ServiceM8 itself.';
    case 'type':
      return 'Only photos and PDFs go to ServiceM8 from here.';
    case 'no-pin':
      return 'Add your PIN in Settings first.';
    case 'wrong-pin':
      return 'Wrong PIN: check it in Settings.';
    case 'missing':
      return 'Type the name and what they want.';
    case 'bad-time':
      return 'The end has to be after the start.';
    case 'bad-email':
      return 'That email address doesn’t look right.';
    case 'missing-mail':
      return 'Write a subject and a message first.';
    case 'bad-mobile':
      return 'That mobile number doesn’t look right.';
    case 'missing-text':
      return 'Write the text first.';
    case 'missing-note':
      return 'Write the note first.';
    case 'bad-amount':
      return 'Type the amount in pounds, like 1500 or 1500.50.';
    case 'bad-date':
      return 'Pick a day up to today.';
    case 'missing-method':
      return 'Pick how they paid.';
    case 'offline':
    case 'sm8-down':
      return `No signal, or ServiceM8 isn’t answering.${at ? ` Showing the list from ${clock(at)}.` : ''}`;
    default:
      if (/credit/i.test(detail ?? '')) return 'ServiceM8 says there aren’t enough text credits. Top them up in ServiceM8, or send an email instead.';
      if (/character set/i.test(detail ?? '')) return 'ServiceM8 wouldn’t take some of the characters in it (an emoji or an unusual symbol). Take them out and try again.';
      return `ServiceM8 sent back an error${detail ? `: ${detail}` : '.'}`;
  }
}
