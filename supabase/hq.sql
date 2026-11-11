-- Rafal Solutions HQ: the numbers HQ reads from the cabinetos Supabase project, behind one secret.
-- Applied as migration 'hq_api' (11 Nov 2026). Nothing here removes rows: the connector refuses those words,
-- and a push address that stops working is marked gone instead.

create schema if not exists hq;
revoke all on schema hq from public;

create table if not exists hq.config (key text primary key, value text not null);
alter table hq.config enable row level security;

create table if not exists hq.insights (
  id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
alter table hq.insights enable row level security;

create table if not exists hq.push (
  endpoint text primary key,
  sub jsonb not null,
  label text,
  created_at timestamptz not null default now(),
  last_ok timestamptz,
  fails integer not null default 0,
  gone_at timestamptz
);
alter table hq.push enable row level security;

create table if not exists hq.sent (
  day date primary key,
  at timestamptz not null default now(),
  body jsonb
);
alter table hq.sent enable row level security;

create or replace function hq.secret_ok(s text) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from hq.config
    where key = 'secret_sha256' and value = encode(sha256(convert_to(coalesce(s, ''), 'UTF8')), 'hex')
  );
$$;
revoke all on function hq.secret_ok(text) from public;

create or replace function public.hq_api(p_secret text, p_action text, p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  d0 date := (now() at time zone 'Europe/London')::date;
  since timestamptz := ((now() at time zone 'Europe/London')::date - 14)::timestamp at time zone 'Europe/London';
  out jsonb := '{}'::jsonb;
  it jsonb;
  n integer;
begin
  if not hq.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;

  if p_action = 'report' then
    return jsonb_build_object(
      'today', d0,
      'rafsite', jsonb_build_object(
        'goals', coalesce((
          select jsonb_agg(jsonb_build_object('day', g.day, 'goal', g.goal, 'taps', g.taps, 'people', g.people))
          from (
            select v.day, c->>'g' as goal, count(*) as taps, count(distinct v.visitor) as people
            from rafsite.views v
            cross join lateral jsonb_array_elements(case when jsonb_typeof(v.clicks) = 'array' then v.clicks else '[]'::jsonb end) c
            where v.day >= d0 - 14 and c ? 'g'
            group by 1, 2
          ) g), '[]'::jsonb)
      ),
      'cabinetos', jsonb_build_object(
        'signups', coalesce((
          select jsonb_agg(jsonb_build_object('day', s.day, 'n', s.n))
          from (
            select (created_at at time zone 'Europe/London')::date as day, count(*) as n
            from public.profiles
            where deleted_at is null and created_at >= since
            group by 1
          ) s), '[]'::jsonb),
        'accounts', (select count(*) from public.profiles where deleted_at is null),
        'paying', coalesce((
          select jsonb_agg(jsonb_build_object('plan', q.plan, 'status', q.subscription_status, 'n', q.n))
          from (
            select plan, subscription_status, count(*) as n
            from public.profiles
            where deleted_at is null and subscription_status in ('active', 'trialing', 'past_due')
            group by 1, 2
          ) q), '[]'::jsonb),
        'sketchup', coalesce((
          select jsonb_agg(jsonb_build_object('day', k.day, 'action', k.action, 'n', k.n))
          from (
            select (created_at at time zone 'Europe/London')::date as day, meta->>'action' as action, count(*) as n
            from public.admin_events
            where kind = 'sketchup' and created_at >= since
            group by 1, 2
          ) k), '[]'::jsonb)
      )
    );

  elsif p_action = 'seen' then
    if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') > 60 then
      raise exception 'bad doc';
    end if;
    for it in select value from jsonb_array_elements(p->'items') loop
      if coalesce(it->>'id', '') !~ '^[a-z0-9:._-]{3,120}$' then
        raise exception 'bad doc';
      end if;
      insert into hq.insights (id, data) values (it->>'id', coalesce(it->'data', '{}'::jsonb))
      on conflict (id) do update set last_seen = now(), data = excluded.data;
      out := out || jsonb_build_object(it->>'id', (select first_seen from hq.insights where id = it->>'id'));
    end loop;
    return out;

  elsif p_action = 'push_add' then
    if coalesce(p->>'endpoint', '') !~ '^https://' or length(p->>'endpoint') > 1000
       or jsonb_typeof(p->'sub') <> 'object' or length((p->'sub')::text) > 4000 then
      raise exception 'bad doc';
    end if;
    insert into hq.push (endpoint, sub, label) values (p->>'endpoint', p->'sub', left(p->>'label', 60))
    on conflict (endpoint) do update set sub = excluded.sub, label = excluded.label, fails = 0, gone_at = null;
    return jsonb_build_object('ok', true);

  elsif p_action = 'push_off' then
    update hq.push set gone_at = now() where endpoint = p->>'endpoint';
    return jsonb_build_object('ok', true);

  elsif p_action = 'push_list' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'sub', sub, 'label', label, 'created_at', created_at, 'last_ok', last_ok))
      from hq.push where gone_at is null), '[]'::jsonb);

  elsif p_action = 'push_result' then
    if (p->>'ok')::boolean then
      update hq.push set last_ok = now(), fails = 0 where endpoint = p->>'endpoint';
    elsif coalesce((p->>'gone')::boolean, false) then
      update hq.push set gone_at = now() where endpoint = p->>'endpoint';
    else
      update hq.push set fails = fails + 1, gone_at = case when fails + 1 >= 5 then now() else gone_at end
      where endpoint = p->>'endpoint';
    end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'claim_day' then
    insert into hq.sent (day, body) values ((p->>'day')::date, p->'body') on conflict (day) do nothing;
    get diagnostics n = row_count;
    return jsonb_build_object('claimed', n > 0);

  elsif p_action = 'last_sent' then
    return coalesce((select jsonb_build_object('day', day, 'at', at, 'body', body) from hq.sent order by day desc limit 1), 'null'::jsonb);
  end if;

  raise exception 'bad action';
end;
$$;

revoke all on function public.hq_api(text, text, jsonb) from public;
grant execute on function public.hq_api(text, text, jsonb) to anon, service_role;
