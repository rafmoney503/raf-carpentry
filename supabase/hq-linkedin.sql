-- Rafal Solutions HQ: Rafal's LinkedIn numbers, a row a day. LinkedIn has no way for an app to read a personal
-- profile's numbers, so they are typed in HQ from LinkedIn's own Analytics box (or put in by Claude when it has the
-- profile open in the browser). Applied as migration 'hq_linkedin' (15 Nov 2026). New table and function only;
-- nothing here removes rows.

create table if not exists hq.linkedin (
  day date primary key,
  followers integer,
  connections integer,
  profile_views integer,       -- LinkedIn's "profile views", past 90 days
  search_appearances integer,  -- "search appearances", past 7 days
  post_impressions integer,    -- "post impressions", past 7 days
  source text not null default 'typed' check (source in ('typed', 'browser')),
  at timestamptz not null default now()
);
alter table hq.linkedin enable row level security;

create or replace function public.hq_linkedin(p_secret text, p_action text, p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  d0 date := (now() at time zone 'Europe/London')::date;
  d date;
  src text;
  n jsonb;
begin
  if not hq.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;

  if p_action = 'put' then
    d := coalesce(nullif(p->>'day', '')::date, d0);
    if d > d0 or d < d0 - 400 then
      raise exception 'bad day';
    end if;
    src := case when p->>'source' = 'browser' then 'browser' else 'typed' end;
    -- Each number a whole number from 0 to 10 million, or left out.
    for n in select value from jsonb_each(p) where key in ('followers', 'connections', 'profileViews', 'searchAppearances', 'postImpressions') loop
      if jsonb_typeof(n) <> 'null' and (jsonb_typeof(n) <> 'number' or (n#>>'{}')::numeric <> floor((n#>>'{}')::numeric) or (n#>>'{}')::numeric < 0 or (n#>>'{}')::numeric > 10000000) then
        raise exception 'bad number';
      end if;
    end loop;
    insert into hq.linkedin as l (day, followers, connections, profile_views, search_appearances, post_impressions, source, at)
    values (d, (p->>'followers')::int, (p->>'connections')::int, (p->>'profileViews')::int, (p->>'searchAppearances')::int, (p->>'postImpressions')::int, src, now())
    on conflict (day) do update set
      followers = coalesce(excluded.followers, l.followers),
      connections = coalesce(excluded.connections, l.connections),
      profile_views = coalesce(excluded.profile_views, l.profile_views),
      search_appearances = coalesce(excluded.search_appearances, l.search_appearances),
      post_impressions = coalesce(excluded.post_impressions, l.post_impressions),
      source = excluded.source,
      at = now();
  elsif p_action <> 'list' then
    raise exception 'bad action';
  end if;

  return jsonb_build_object(
    'today', d0,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', l.day, 'followers', l.followers, 'connections', l.connections, 'profileViews', l.profile_views,
        'searchAppearances', l.search_appearances, 'postImpressions', l.post_impressions, 'source', l.source,
        'at', (extract(epoch from l.at) * 1000)::bigint
      ) order by l.day)
      from hq.linkedin l where l.day > d0 - 400
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.hq_linkedin(text, text, jsonb) from public;
grant execute on function public.hq_linkedin(text, text, jsonb) to anon, service_role;
