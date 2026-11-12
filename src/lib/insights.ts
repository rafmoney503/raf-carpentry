import { morningLine } from './assistant';
import { median, plural, sum } from './format';
import { addDays, dayMonth } from './time';
import type { Insight, Leads, Report, SiteStats } from './types';

/* "Worth knowing": plain rules over the numbers, newest problems first. No guessing: every line is a count HQ
   read. Ids stay the same while the same thing is true, so HQ knows when it first saw each one. */

const DASH = 'https://vercel.com/rafals-projects-ecbcd9de';

export function buildInsights(sites: SiteStats[], leads: Leads | null, today: string, messages: Report['messages'] = null): Insight[] {
  const out: Insight[] = [];

  /* New messages from Tell us: a new card (and a line in the morning summary) each time another one comes in. */
  if (messages && messages.unread > 0 && messages.newest) {
    out.push({
      id: `tellus:${messages.newest}`,
      site: 'builditin3d',
      tone: 'good',
      mark: String(messages.unread),
      where: 'Build It in 3D',
      title: `${plural(messages.unread, 'new message')} on Build It in 3D`,
      body: 'What people sent with Tell us: ideas, things that didn’t work, where they got stuck. Read them, then mark them read.',
      action: { label: 'Read them', href: '/messages' },
    });
  }
  const week = addDays(today, -7);

  for (const s of sites) {
    if (s.up && !s.up.ok) {
      out.push({
        id: `down:${s.key}:${today}`,
        site: s.key,
        tone: 'alert',
        mark: '!',
        where: s.name,
        title: `${s.name} isn\u2019t answering`,
        body: s.up.status ? `It answered ${s.up.status} just now. Open it to check.` : 'It didn’t answer within 8 seconds. Open it to check.',
        action: { label: `Open ${s.sub}`, href: s.url, external: true },
      });
    }
    if (s.deploy && s.deploy.state === 'ERROR') {
      out.push({
        id: `deploy:${s.key}:${s.deploy.at}`,
        site: s.key,
        tone: 'alert',
        mark: '!',
        where: s.name,
        title: `The last update to ${s.name} didn’t go live`,
        body: s.deploy.message ? `“${s.deploy.message}” failed to build. The site still shows the version before.` : 'It failed to build. The site still shows the version before.',
        action: { label: 'See it in Vercel', href: `${DASH}/${s.vercelName}/deployments`, external: true },
      });
    }
  }

  for (const s of sites) {
    if (s.status !== 'ok') continue;

    for (const src of s.sources) {
      if (!src.isNew || src.visitors < 3) continue;
      const classroom = src.name === 'Google Classroom';
      out.push({
        id: `source:${s.key}:${src.key}`,
        site: s.key,
        tone: 'good',
        mark: classroom ? 'GC' : '+',
        where: s.name,
        title: classroom ? `A teacher shared ${s.name}` : `A new way in: ${src.name}`,
        body: `${src.name} sent ${plural(src.visitors, 'person', 'people')} in the last 7 days. Nobody came from there in the 4 weeks before.`,
        viz: { type: 'dots', n: Math.min(src.visitors, 12), color: s.color, label: `from ${src.name}` },
        action: { label: 'See where visitors come from', href: `/apps/${s.key}#sources` },
      });
    }

    const complete = s.days.slice(0, -1);
    const recent = complete.slice(-14);
    if (recent.length >= 7) {
      let iMax = 0;
      recent.forEach((d, i) => {
        if (d.visitors > recent[iMax].visitors) iMax = i;
      });
      const top = recent[iMax];
      const others = complete.filter((d) => d.day !== top.day).map((d) => d.visitors);
      const med = median(others);
      if (top.visitors >= 20 && med > 0 && top.visitors >= med * 2.5) {
        const times = Math.round(top.visitors / med);
        const inLastWeek = top.day >= addDays(today, -14) && top.day < week;
        const inThisWeek = top.day >= week && top.day < today;
        let body = `${plural(top.visitors, 'visitor')} in one day, about ${times} times a normal day.`;
        if ((inLastWeek || inThisWeek) && s.lastWeek > 0) {
          const nowW = inThisWeek ? s.week - top.visitors + Math.round(med) : s.week;
          const lastW = inLastWeek ? s.lastWeek - top.visitors + Math.round(med) : s.lastWeek;
          const p = Math.round(((nowW - lastW) / lastW) * 100);
          body += Math.abs(p) < 3
            ? ' Count it as a normal day and the last 7 days are the same as the week before.'
            : ` Count it as a normal day and the last 7 days are ${p > 0 ? 'up' : 'down'} ${Math.abs(p)}% on the week before.`;
        }
        out.push({
          id: `spike:${s.key}:${top.day}`,
          site: s.key,
          tone: 'info',
          mark: String(top.visitors),
          where: s.name,
          title: `${dayMonth(top.day)} was ${s.name}’s busiest day`,
          body,
          viz: { type: 'bars', values: recent.map((d) => d.visitors), mark: iMax, color: s.color, dim: '#e3e1db' },
          action: { label: 'See that day', href: `/apps/${s.key}?day=${top.day}` },
        });
      } else {
        weekChange(s, out, today);
      }
    }

    if (s.homeOnly !== null && s.week >= 20 && s.homeOnly / s.week >= 0.6) {
      out.push({
        id: `home:${s.key}:${week}`,
        site: s.key,
        tone: 'info',
        mark: '→',
        where: s.name,
        title: 'Most visitors stop at the home page',
        body: `${s.homeOnly} of ${s.week} people in the last 7 days didn’t open another page.`,
        viz: {
          type: 'bar',
          parts: [
            { n: s.homeOnly, label: `${s.homeOnly} saw only the home page`, color: 'var(--ink)' },
            { n: s.week - s.homeOnly, label: `${s.week - s.homeOnly} went further`, color: s.color },
          ],
        },
        action: { label: 'See which pages they open', href: `/apps/${s.key}#pages` },
      });
    }
  }

  if (leads) {
    const c = leads.cabinetos;
    const yesterday = addDays(today, -1);
    if (c.signupsToday > 0) {
      out.push({
        id: `signup:${today}`,
        site: 'cabinetos',
        tone: 'good',
        mark: '+',
        where: 'CabinetOS',
        title: `${plural(c.signupsToday, 'new CabinetOS account')} today`,
        body: `${plural(c.signupsWeek, 'sign-up')} in the 7 days to yesterday, ${c.accounts} accounts in all.`,
        action: { label: 'See CabinetOS', href: '/apps/cabinetos' },
      });
    } else if (c.signupsYesterday > 0) {
      out.push({
        id: `signup:${yesterday}`,
        site: 'cabinetos',
        tone: 'good',
        mark: '+',
        where: 'CabinetOS',
        title: `${plural(c.signupsYesterday, 'new CabinetOS account')} yesterday`,
        body: `${plural(c.signupsWeek, 'sign-up')} in the last 7 days, ${c.accounts} accounts in all.`,
        action: { label: 'See CabinetOS', href: '/apps/cabinetos' },
      });
    }
    const quote = leads.rafsite.find((g) => g.goal === 'quote');
    if (quote && quote.week >= 6 && quote.last > 0 && Math.abs(quote.week - quote.last) / quote.last >= 0.5) {
      const up = quote.week > quote.last;
      out.push({
        id: `quote:${week}:${up ? 'up' : 'down'}`,
        site: 'rafcarpentry',
        tone: up ? 'good' : 'info',
        mark: '£',
        where: 'rafcarpentry.com',
        title: `Get a quote taps ${up ? 'up' : 'down'}: ${quote.week} against ${quote.last}`,
        body: `Taps on Get a quote on rafcarpentry.com in the 7 days to yesterday, against the 7 days before.`,
        action: { label: 'See all the leads', href: '/leads' },
      });
    }
  }

  const off = sites.filter((s) => s.status === 'not-counting');
  if (off.length) {
    out.push({
      id: `setup:counting:${off.map((s) => s.key).join('-')}`,
      tone: 'setup',
      mark: String(off.length),
      where: 'Set-up',
      title: off.length === 1 ? `${off[0].name} isn’t counted yet` : `${off.length} sites aren’t counted yet`,
      body: `${off.map((s) => s.name).join(' and ')} ${off.length === 1 ? 'has' : 'have'} no visit counting, so ${off.length === 1 ? 'it’s' : 'they’re'} missing from every number here. In Vercel: the project, Analytics, Enable.`,
      viz: { type: 'chips', items: off.map((s) => s.sub) },
      action: { label: `Switch on for ${off[0].name}`, href: `${DASH}/${off[0].vercelName}/analytics`, external: true },
    });
  }

  const order = { alert: 0, good: 1, info: 2, setup: 3 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

function weekChange(s: SiteStats, out: Insight[], today: string) {
  if (s.week + s.lastWeek < 40 || s.lastWeek <= 0) return;
  const p = Math.round(((s.week - s.lastWeek) / s.lastWeek) * 100);
  if (Math.abs(p) < 25) return;
  const up = p > 0;
  const days = s.days.slice(-15, -1);
  out.push({
    id: `change:${s.key}:${addDays(today, -7)}:${up ? 'up' : 'down'}`,
    site: s.key,
    tone: up ? 'good' : 'info',
    mark: up ? '↑' : '↓',
    where: s.name,
    title: `${s.name} is ${up ? 'up' : 'down'} ${Math.abs(p)}% on the week before`,
    body: `${plural(s.week, 'visitor')} in the 7 days to yesterday, against ${s.lastWeek} the 7 days before.`,
    viz: { type: 'bars', values: days.map((d) => d.visitors), mark: days.length - 1, color: s.color, dim: '#e3e1db' },
    action: { label: `See ${s.name}`, href: `/apps/${s.key}` },
  });
}

/* The morning summary: yesterday's visitors per site, and leads. */
export function morningSummary(sites: SiteStats[], leads: Leads | null, today: string, messages: Report['messages'] = null, assistant: Report['assistant'] = null): { title: string; body: string } {
  const counted = sites.filter((s) => s.status === 'ok');
  const y = addDays(today, -1);
  const total = sum(counted.map((s) => s.yesterday));
  const parts = counted.filter((s) => s.yesterday > 0).map((s) => `${s.name} ${s.yesterday}`);
  const extra: string[] = [];
  if (leads) {
    const qy = leads.rafsiteDays.find((d) => d.day === y);
    if (qy && qy.taps) extra.push(`${plural(qy.taps, 'tap')} to get in touch on rafcarpentry.com`);
    if (leads.cabinetos.signupsYesterday) extra.push(plural(leads.cabinetos.signupsYesterday, 'new CabinetOS account'));
  }
  if (messages?.yesterday) extra.push(`${plural(messages.yesterday, 'message')} on Build It in 3D`);
  const enq = morningLine(assistant);
  if (enq) extra.push(enq);
  return {
    title: `Yesterday: ${plural(total, 'visitor')} across ${plural(counted.length, 'site')}`,
    body: [parts.join(' · '), extra.join(' · ')].filter(Boolean).join('\n'),
  };
}
