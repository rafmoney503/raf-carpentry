/* Talking to /api/job-kit/sm8 (ServiceM8, behind the PIN) from the Job Kit, and saying what went wrong in plain
   words. Shared by Current jobs (current.tsx) and a job's emails (mail.tsx). */

export const clock = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function post<T>(pin: string, body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string; detail?: string }> {
  if (!pin) return { ok: false, error: 'no-pin' };
  try {
    const res = await fetch('/api/job-kit/sm8', { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
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
      return /quota/i.test(detail ?? '') ? 'ServiceM8 says today’s email allowance is used up. Try again tomorrow, or email from ServiceM8.' : 'ServiceM8 is busy. Try again in a minute.';
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
    case 'offline':
    case 'sm8-down':
      return `No signal, or ServiceM8 isn’t answering.${at ? ` Showing the list from ${clock(at)}.` : ''}`;
    default:
      if (/character set/i.test(detail ?? '')) return 'ServiceM8 wouldn’t take some of the characters in it (an emoji or an unusual symbol). Take them out and try again.';
      return `ServiceM8 sent back an error${detail ? `: ${detail}` : '.'}`;
  }
}
