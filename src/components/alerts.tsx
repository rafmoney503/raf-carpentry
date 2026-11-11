'use client';

import { useEffect, useState } from 'react';
import type { Note } from '@/lib/push';
import { Mark } from './ui';

type State = 'checking' | 'unsupported' | 'ios-home' | 'denied' | 'off' | 'on' | 'busy';

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function label(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows computer';
  return 'This device';
}

export function AlertsClient({ vapid, ready, preview }: { vapid: string; ready: boolean; preview: Note[] }) {
  const [state, setState] = useState<State>('checking');
  const [msg, setMsg] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [devices, setDevices] = useState<{ endpoint: string; label: string | null; lastOk: string | null }[] | null>(null);

  async function loadDevices() {
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) }).catch(() => null);
    if (res?.ok) setDevices(((await res.json()) as { devices: typeof devices }).devices ?? []);
  }

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(ios && !standalone ? 'ios-home' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      if (sub) setEndpoint(sub.endpoint);
      setState(sub ? 'on' : 'off');
      loadDevices();
    })().catch(() => setState('unsupported'));
  }, []);

  async function turnOn() {
    setState('busy');
    setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) as BufferSource });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', sub: sub.toJSON(), label: label() }) });
      if (!res.ok) throw new Error();
      setEndpoint(sub.endpoint);
      setState('on');
      setMsg('On. The first summary comes tomorrow at 7:43.');
      loadDevices();
    } catch {
      setState('off');
      setMsg('That didn’t work. Try again in a moment.');
    }
  }

  async function turnOff() {
    setState('busy');
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'off', endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setEndpoint('');
    setState('off');
    setMsg('Off on this device.');
    loadDevices();
  }

  async function test() {
    setMsg('Sending…');
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', endpoint }) }).catch(() => null);
    setMsg(res?.ok ? 'Sent. It should arrive in a few seconds.' : 'It didn’t send. Turn it off and on again.');
  }

  return (
    <>
      <section className="card" aria-label="On this device">
        <div className="head">
          <h2>On this device</h2>
          <span>{state === 'on' ? 'On' : state === 'checking' ? '' : 'Off'}</span>
        </div>
        {!ready ? <p>The morning summary isn&apos;t set up on the server yet.</p> : null}
        {state === 'ios-home' ? (
          <p>
            On an iPhone, HQ can only send alerts once it&apos;s on your Home Screen: tap Share, then Add to Home Screen, then open HQ from there and come back to Alerts.
          </p>
        ) : null}
        {state === 'unsupported' ? <p>This browser can&apos;t get alerts. Open HQ on your phone instead.</p> : null}
        {state === 'denied' ? <p>Notifications are blocked for HQ. Allow them in the phone&apos;s Settings, under HQ, then come back.</p> : null}
        {ready && (state === 'off' || state === 'busy') && !endpoint ? (
          <button type="button" className="btn solid" onClick={turnOn} disabled={state === 'busy'} style={{ alignSelf: 'flex-start' }}>
            Turn on the morning summary
          </button>
        ) : null}
        {state === 'on' ? (
          <div className="chips">
            <button type="button" className="btn" onClick={test}>
              Send me one now
            </button>
            <button type="button" className="btn" onClick={turnOff}>
              Turn off
            </button>
          </div>
        ) : null}
        {msg ? (
          <p aria-live="polite" className="note">
            {msg}
          </p>
        ) : null}
      </section>

      <section className="card" aria-label="What it says">
        <div className="head">
          <h2>What it would say now</h2>
          <span>{preview.length === 1 ? '1 message' : `${preview.length} messages`}</span>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {preview.map((n) => (
            <div key={n.tag ?? n.title} style={{ display: 'flex', gap: 10, background: 'var(--chip)', borderRadius: 16, padding: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, background: '#121417', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Mark size={20} ink="#121417" plank="#f7f6f2" />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <b style={{ fontSize: 15 }}>{n.title}</b>
                <span style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-line' }}>{n.body}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {devices && devices.length ? (
        <section className="card" aria-label="Devices">
          <div className="head">
            <h2>Gets the summary</h2>
            <span>{devices.length === 1 ? '1 device' : `${devices.length} devices`}</span>
          </div>
          <ul className="rows">
            {devices.map((d) => (
              <li key={d.endpoint}>
                <span>
                  {d.label || 'A device'}
                  {d.endpoint === endpoint ? <small>this one</small> : null}
                </span>
                <b style={{ fontSize: 13, fontFamily: 'var(--body)', color: 'var(--muted)', fontWeight: 500 }}>{d.lastOk ? 'got the last one' : 'none sent yet'}</b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
