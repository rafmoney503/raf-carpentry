-- HQ agents: one standing agent for each job (Money, Day report, Growth, Sales), each with its own report, jobs,
-- things that need Rafal, and notes it keeps from day to day. Applied as migration 'hq_agents' (15 Nov 2026).
--
-- HQ reads and writes it through public.hq_agents (HQ's own secret, hq.secret_ok). The agents themselves are one
-- scheduled Claude task ('HQ agents', hourly 7:00 to 21:00 London) that works through the Supabase connector with
-- the hq.agent_* helpers below (not callable with the publishable key). rafcarpentry.com keeps a snapshot of the
-- ServiceM8 jobs in jobkit.context (public.jobkit_context, the Job Kit's secret) so the agents can read jobs,
-- quotes and money owed without any keys. Nothing here removes rows: notes are marked gone, jobs cancelled.

create table if not exists hq.agents (
  id text primary key,
  name text not null,
  role text not null default '',
  schedule text not null default '',
  sched jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  may text not null default 'act' check (may in ('tell', 'act')),
  paused boolean not null default false,
  brief text not null default '',
  sort integer not null default 0,
  last_run timestamptz,
  updated_at timestamptz not null default now()
);
alter table hq.agents enable row level security;

create table if not exists hq.agent_reports (
  id bigserial primary key,
  agent text not null references hq.agents (id),
  at timestamptz not null default now(),
  headline text not null,
  body text not null default '',
  numbers jsonb not null default '[]'::jsonb,
  foot text not null default ''
);
alter table hq.agent_reports enable row level security;
create index if not exists agent_reports_agent_at on hq.agent_reports (agent, at desc);

create table if not exists hq.agent_jobs (
  id bigserial primary key,
  agent text not null references hq.agents (id),
  text text not null,
  repeat text not null default 'once' check (repeat in ('once', 'daily', 'weekly', 'date')),
  weekday integer check (weekday between 1 and 7),
  on_day date,
  status text not null default 'waiting' check (status in ('waiting', 'working', 'done', 'failed', 'cancelled')),
  answer text not null default '',
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  picked_at timestamptz,
  done_at timestamptz,
  runs integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table hq.agent_jobs enable row level security;
create index if not exists agent_jobs_agent on hq.agent_jobs (agent, status, due_at);

create table if not exists hq.agent_needs (
  id bigserial primary key,
  agent text not null references hq.agents (id),
  text text not null,
  how text not null default '',
  button text not null default 'do' check (button in ('do', 'done')),
  action jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'doing', 'done', 'no')),
  result text not null default '',
  created_at timestamptz not null default now(),
  marked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table hq.agent_needs enable row level security;
create index if not exists agent_needs_agent on hq.agent_needs (agent, status, created_at desc);

create table if not exists hq.agent_notes (
  id bigserial primary key,
  agent text not null references hq.agents (id),
  text text not null,
  by text not null default 'agent' check (by in ('agent', 'raf')),
  at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  gone_at timestamptz
);
alter table hq.agent_notes enable row level security;

create table if not exists hq.agent_runs (
  id bigserial primary key,
  at timestamptz not null default now(),
  ms integer,
  did jsonb not null default '{}'::jsonb,
  problems jsonb not null default '[]'::jsonb
);
alter table hq.agent_runs enable row level security;

-- the snapshot of ServiceM8 that rafcarpentry.com keeps for the agents (key 'business')
create table if not exists jobkit.context (
  key text primary key,
  data jsonb not null,
  at timestamptz not null default now()
);
alter table jobkit.context enable row level security;

-- ---------------------------------------------------------------- small helpers

create or replace function hq.ms(t timestamptz) returns bigint
language sql immutable set search_path to '' as $$ select (extract(epoch from t) * 1000)::bigint $$;

-- a day and a time on London's clock, as a moment
create or replace function hq.agent_at(d date, hhmm text default '07:00') returns timestamptz
language sql stable set search_path to '' as $$ select (d + hhmm::time) at time zone 'Europe/London' $$;

-- when a new job is first due
create or replace function hq.agent_first_due(p_repeat text, p_weekday integer, p_on date) returns timestamptz
language plpgsql stable set search_path to '' as $$
declare t date := (now() at time zone 'Europe/London')::date;
begin
  if p_repeat = 'weekly' then
    if extract(isodow from t)::int = p_weekday then return now(); end if;
    return hq.agent_at(t + ((p_weekday - extract(isodow from t)::int + 7) % 7));
  elsif p_repeat = 'date' then
    return greatest(now(), hq.agent_at(p_on));
  end if;
  return now();
end $$;

-- when a repeating job is next due, after it has been done today
create or replace function hq.agent_next_due(p_repeat text, p_weekday integer) returns timestamptz
language plpgsql stable set search_path to '' as $$
declare t date := (now() at time zone 'Europe/London')::date;
begin
  if p_repeat = 'weekly' then
    return hq.agent_at(t + ((p_weekday - extract(isodow from t)::int + 6) % 7) + 1);
  end if;
  return hq.agent_at(t + 1);
end $$;

-- one agent for HQ: its settings, latest report, what needs Rafal, its jobs and its notes
create or replace function hq.agent_json(p_id text) returns jsonb
language sql stable set search_path to '' as $$
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'role', g.role, 'schedule', g.schedule, 'sched', g.sched, 'sources', g.sources,
    'may', g.may, 'paused', g.paused, 'brief', g.brief, 'lastRun', hq.ms(g.last_run),
    'report', (
      select jsonb_build_object('id', r.id, 'at', hq.ms(r.at), 'headline', r.headline, 'body', r.body,
        'numbers', r.numbers, 'foot', r.foot)
      from hq.agent_reports r where r.agent = g.id order by r.at desc limit 1),
    'needs', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'text', n.text, 'how', n.how, 'button', n.button,
        'action', n.action, 'status', n.status, 'result', n.result, 'at', hq.ms(n.created_at),
        'marked', hq.ms(n.marked_at)) order by n.created_at desc)
      from (select * from hq.agent_needs where agent = g.id
            and (status in ('open', 'doing') or marked_at > now() - interval '2 days')
            order by created_at desc limit 30) n), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object('id', j.id, 'text', j.text, 'repeat', j.repeat, 'weekday', j.weekday,
        'onDay', j.on_day, 'status', j.status, 'answer', j.answer, 'due', hq.ms(j.due_at), 'at', hq.ms(j.created_at),
        'done', hq.ms(j.done_at), 'runs', j.runs) order by j.created_at desc)
      from (select * from hq.agent_jobs where agent = g.id
            and (status in ('waiting', 'working') or (status in ('done', 'failed') and done_at > now() - interval '21 days'))
            order by created_at desc limit 40) j), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text, 'by', o.by, 'at', hq.ms(o.at)) order by o.at)
      from hq.agent_notes o where o.agent = g.id and o.gone_at is null), '[]'::jsonb))
  from hq.agents g where g.id = p_id;
$$;

-- ---------------------------------------------------------------- HQ's function

create or replace function public.hq_agents(p_secret text, p_action text, p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  a text := p->>'agent';
  i bigint := nullif(p->>'id', '')::bigint;
  t text := btrim(coalesce(p->>'text', ''));
  rep text := coalesce(p->>'repeat', 'once');
  wd integer := nullif(p->>'weekday', '')::int;
  od date := nullif(p->>'onDay', '')::date;
  st text := p->>'status';
  row_id bigint;
begin
  if not hq.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;

  if p_action = 'list' then
    return jsonb_build_object(
      'now', hq.ms(now()),
      'agents', coalesce((select jsonb_agg(hq.agent_json(g.id) order by g.sort, g.id) from hq.agents g), '[]'::jsonb),
      'run', (select jsonb_build_object('at', hq.ms(x.at), 'ms', x.ms, 'did', x.did, 'problems', x.problems)
              from hq.agent_runs x order by x.at desc limit 1),
      'review', (select jsonb_build_object('day', substr(v.id, 5), 'headline', v.data->'review'->>'headline')
                 from jobkit.reviews v where v.id like 'day:%' and v.state = 'ready' order by v.id desc limit 1));
  end if;

  if a is not null and not exists (select 1 from hq.agents where id = a) then
    raise exception 'no such agent';
  end if;

  if p_action = 'job_add' then
    if a is null or t = '' or length(t) > 2000 then raise exception 'bad job'; end if;
    if rep not in ('once', 'daily', 'weekly', 'date') then raise exception 'bad repeat'; end if;
    if rep = 'weekly' and (wd is null or wd not between 1 and 7) then raise exception 'bad weekday'; end if;
    if rep = 'date' and (od is null or od < (now() at time zone 'Europe/London')::date) then raise exception 'bad day'; end if;
    insert into hq.agent_jobs (agent, text, repeat, weekday, on_day, due_at)
    values (a, t, rep, case when rep = 'weekly' then wd end, case when rep = 'date' then od end,
            hq.agent_first_due(rep, wd, od))
    returning id into row_id;
    return hq.agent_json(a) || jsonb_build_object('added', row_id);
  end if;

  if p_action = 'job_cancel' then
    update hq.agent_jobs set status = 'cancelled', updated_at = now()
    where id = i and status in ('waiting', 'failed') returning agent into a;
    if a is null then raise exception 'no such job'; end if;
    return hq.agent_json(a);
  end if;

  if p_action = 'need_mark' then
    if st not in ('open', 'doing', 'done', 'no') then raise exception 'bad status'; end if;
    update hq.agent_needs set status = st, marked_at = case when st = 'open' then null else now() end, updated_at = now()
    where id = i returning agent into a;
    if a is null then raise exception 'no such need'; end if;
    return hq.agent_json(a);
  end if;

  if p_action = 'note_add' then
    if a is null or t = '' or length(t) > 500 then raise exception 'bad note'; end if;
    insert into hq.agent_notes (agent, text, by) values (a, t, 'raf');
    return hq.agent_json(a);
  end if;

  if p_action = 'note_edit' then
    if t = '' or length(t) > 500 then raise exception 'bad note'; end if;
    update hq.agent_notes set text = t, by = 'raf', updated_at = now() where id = i and gone_at is null returning agent into a;
    if a is null then raise exception 'no such note'; end if;
    return hq.agent_json(a);
  end if;

  if p_action = 'note_gone' then
    update hq.agent_notes set gone_at = now(), updated_at = now() where id = i and gone_at is null returning agent into a;
    if a is null then raise exception 'no such note'; end if;
    return hq.agent_json(a);
  end if;

  if p_action = 'settings' then
    if a is null then raise exception 'bad agent'; end if;
    update hq.agents set
      may = case when p ? 'may' and p->>'may' in ('tell', 'act') then p->>'may' else may end,
      paused = case when p ? 'paused' then coalesce((p->>'paused')::boolean, paused) else paused end,
      brief = case when p ? 'brief' then left(btrim(coalesce(p->>'brief', '')), 2000) else brief end,
      updated_at = now()
    where id = a;
    return hq.agent_json(a);
  end if;

  raise exception 'bad action';
end $$;
revoke all on function public.hq_agents(text, text, jsonb) from public;
grant execute on function public.hq_agents(text, text, jsonb) to anon, service_role;

-- ---------------------------------------------------------------- the agents' own helpers (the scheduled task)

-- what the hourly run has to do now: reports due, jobs due, needs Rafal said Do it to
create or replace function hq.agents_due() returns jsonb
language plpgsql stable set search_path to '' as $$
declare
  ln timestamp := now() at time zone 'Europe/London';
  today date := ln::date;
  out_reports jsonb := '[]'::jsonb;
  ag record;
  last_at timestamptz;
  due boolean;
begin
  for ag in select * from hq.agents where not paused order by sort loop
    select max(at) into last_at from hq.agent_reports where agent = ag.id;
    due := false;
    if ag.sched->>'kind' in ('daily', 'days') then
      due := ln::time >= (ag.sched->>'at')::time
        and (last_at is null or (last_at at time zone 'Europe/London')::date < today)
        and (ag.sched->>'kind' = 'daily' or (ag.sched->'days') @> to_jsonb(extract(isodow from today)::int));
    elsif ag.sched->>'kind' = 'every' then
      due := ln::time between (ag.sched->>'from')::time and (ag.sched->>'to')::time
        and (last_at is null or now() - last_at >= make_interval(hours => (ag.sched->>'hours')::int) - interval '15 minutes');
    end if;
    if due then out_reports := out_reports || to_jsonb(ag.id); end if;
  end loop;
  return jsonb_build_object(
    'now', now(), 'london', ln,
    'reports', out_reports,
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'agent', j.agent, 'text', j.text, 'repeat', j.repeat,
      'answer', j.answer, 'runs', j.runs) order by j.due_at)
      from hq.agent_jobs j join hq.agents g on g.id = j.agent
      where not g.paused and j.status = 'waiting' and j.due_at <= now()), '[]'::jsonb),
    'doing', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'agent', n.agent, 'text', n.text, 'how', n.how,
      'action', n.action) order by n.marked_at)
      from hq.agent_needs n join hq.agents g on g.id = n.agent
      where not g.paused and n.status = 'doing'), '[]'::jsonb));
end $$;

create or replace function hq.agent_job_start(p_id bigint) returns void
language sql set search_path to '' as $$
  update hq.agent_jobs set status = 'working', picked_at = now(), updated_at = now() where id = p_id and status = 'waiting';
$$;

-- a job finished: once and dated jobs are done (or failed); repeating ones wait for their next day
create or replace function hq.agent_job_done(p_id bigint, p_answer text, p_ok boolean default true) returns void
language sql set search_path to '' as $$
  update hq.agent_jobs set
    answer = left(coalesce(p_answer, ''), 8000),
    done_at = now(),
    runs = runs + 1,
    status = case when repeat in ('daily', 'weekly') then 'waiting' when p_ok then 'done' else 'failed' end,
    due_at = case when repeat in ('daily', 'weekly') then hq.agent_next_due(repeat, weekday) else due_at end,
    updated_at = now()
  where id = p_id;
$$;

create or replace function hq.agent_report_add(p_agent text, p_headline text, p_body text default '',
  p_numbers jsonb default '[]'::jsonb, p_foot text default '') returns bigint
language plpgsql set search_path to '' as $$
declare r bigint;
begin
  insert into hq.agent_reports (agent, headline, body, numbers, foot)
  values (p_agent, left(p_headline, 300), left(coalesce(p_body, ''), 8000), coalesce(p_numbers, '[]'::jsonb), left(coalesce(p_foot, ''), 400))
  returning id into r;
  update hq.agents set last_run = now() where id = p_agent;
  return r;
end $$;

-- something for Rafal: a Do it (the agent does it on its next run, or HQ opens action.open) or a Done (Rafal does it)
create or replace function hq.agent_need_add(p_agent text, p_text text, p_how text default '', p_button text default 'do',
  p_action jsonb default '{}'::jsonb) returns bigint
language plpgsql set search_path to '' as $$
declare r bigint;
begin
  select id into r from hq.agent_needs where agent = p_agent and text = left(p_text, 600) and status in ('open', 'doing');
  if r is not null then return r; end if;
  insert into hq.agent_needs (agent, text, how, button, action)
  values (p_agent, left(p_text, 600), left(coalesce(p_how, ''), 300), case when p_button = 'done' then 'done' else 'do' end,
          coalesce(p_action, '{}'::jsonb))
  returning id into r;
  return r;
end $$;

-- a need the agent has dealt with (after Do it), or one that no longer applies
create or replace function hq.agent_need_close(p_id bigint, p_status text, p_result text default '') returns void
language sql set search_path to '' as $$
  update hq.agent_needs set status = case when p_status in ('done', 'no') then p_status else 'done' end,
    result = left(coalesce(p_result, ''), 2000), marked_at = coalesce(marked_at, now()), updated_at = now()
  where id = p_id;
$$;

create or replace function hq.agent_note_add(p_agent text, p_text text) returns bigint
language plpgsql set search_path to '' as $$
declare r bigint;
begin
  select id into r from hq.agent_notes where agent = p_agent and text = left(p_text, 500) and gone_at is null;
  if r is not null then return r; end if;
  insert into hq.agent_notes (agent, text, by) values (p_agent, left(p_text, 500), 'agent') returning id into r;
  return r;
end $$;

create or replace function hq.agent_run_add(p_ms integer, p_did jsonb, p_problems jsonb default '[]'::jsonb) returns void
language sql set search_path to '' as $$
  insert into hq.agent_runs (ms, did, problems) values (p_ms, coalesce(p_did, '{}'::jsonb), coalesce(p_problems, '[]'::jsonb));
$$;

revoke all on function hq.ms(timestamptz), hq.agent_at(date, text), hq.agent_first_due(text, integer, date),
  hq.agent_next_due(text, integer), hq.agent_json(text), hq.agents_due(), hq.agent_job_start(bigint),
  hq.agent_job_done(bigint, text, boolean), hq.agent_report_add(text, text, text, jsonb, text),
  hq.agent_need_add(text, text, text, text, jsonb), hq.agent_need_close(bigint, text, text),
  hq.agent_note_add(text, text), hq.agent_run_add(integer, jsonb, jsonb) from public;

-- ---------------------------------------------------------------- rafcarpentry.com's snapshot

create or replace function public.jobkit_context(p_secret text, p_action text, p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path to '' as $$
declare k text := p->>'key';
begin
  if not jobkit.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;
  if k is null or k !~ '^[a-z]{2,20}$' then raise exception 'bad key'; end if;
  if p_action = 'put' then
    if jsonb_typeof(p->'data') <> 'object' or length((p->'data')::text) > 400000 then raise exception 'bad data'; end if;
    insert into jobkit.context (key, data, at) values (k, p->'data', now())
    on conflict (key) do update set data = excluded.data, at = excluded.at;
    return jsonb_build_object('ok', true);
  end if;
  if p_action = 'get' then
    return (select jsonb_build_object('data', c.data, 'at', hq.ms(c.at)) from jobkit.context c where c.key = k);
  end if;
  raise exception 'bad action';
end $$;
revoke all on function public.jobkit_context(text, text, jsonb) from public;
grant execute on function public.jobkit_context(text, text, jsonb) to anon, service_role;

-- ---------------------------------------------------------------- the four agents

insert into hq.agents (id, name, role, schedule, sched, sources, sort) values
  ('money', 'Money', 'Money pots, payments, money owed, tax dates and Claude credit', 'Every day at 7:30',
   '{"kind":"daily","at":"07:30"}', '["Money pots","ServiceM8 payments","Claude credit"]', 1),
  ('report', 'Day report', 'Yesterday across all six apps, from the daily review', 'Every day at 7:00',
   '{"kind":"daily","at":"07:00"}', '["Daily review","Website stats","ServiceM8 jobs"]', 2),
  ('growth', 'Growth', 'The sites, Google and social media: what to change next', 'Mon, Wed and Fri at 9:00',
   '{"kind":"days","days":[1,3,5],"at":"09:00"}', '["Website stats","Daily review","Social media","The sites'' code"]', 3),
  ('sales', 'Sales', 'New enquiries, quotes waiting and follow-ups', 'Every 2 hours, 7:00 to 21:00',
   '{"kind":"every","hours":2,"from":"07:00","to":"21:00"}', '["ServiceM8 jobs","Rough quotes","WhatsApp chats"]', 4)
on conflict (id) do nothing;

insert into hq.agent_notes (agent, text, by)
select v.agent, v.text, 'raf' from (values
  ('money', 'VAT quarters end Feb, May, Aug and Nov.'),
  ('money', 'Rafal''s own Self Assessment is his, not the company''s: keep it apart.'),
  ('sales', 'Follow up a quote after 5 days with no answer. Never message a customer: write it for Rafal to send.'),
  ('growth', 'Changes to a site go on a branch with a preview first. Only merge after Rafal presses Merge.')
) as v(agent, text)
where not exists (select 1 from hq.agent_notes n where n.agent = v.agent and n.text = v.text);
