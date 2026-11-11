'use client';

import { useState } from 'react';
import { Mark } from '@/components/ui';

export default function Login() {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }).catch(() => null);
    if (res?.ok) {
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      return;
    }
    const j = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
    setMsg(j.error === 'wait' ? 'Too many tries. Wait 10 minutes.' : j.error === 'check-down' ? 'Couldn’t check the PIN just now. Try again.' : 'That PIN isn’t right.');
    setBusy(false);
    setPin('');
  }

  return (
    <main className="login">
      <form onSubmit={go}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Mark size={40} ink="var(--ink)" plank="var(--ink)" />
          <span>
            <b style={{ fontFamily: 'var(--display)', fontSize: 22, display: 'block' }}>HQ</b>
            <small style={{ color: 'var(--muted)' }}>Rafal Solutions</small>
          </span>
        </div>
        <label htmlFor="pin">Your PIN (the Job Kit&apos;s)</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
        <p className="msg" aria-live="polite">
          {msg}
        </p>
        <button type="submit" className="btn solid" disabled={busy}>
          {busy ? 'Checking…' : 'Open HQ'}
        </button>
      </form>
    </main>
  );
}
