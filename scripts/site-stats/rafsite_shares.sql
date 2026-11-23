-- A copy of the Supabase migration 'rafsite_shares' (cabinetos project, applied 23 Nov 2026): a job page's Share
-- button (src/components/ShareJob.tsx). Taps carrying `sh` ('<how>:<slug>', how = sheet | wa | copy | email) and the
-- visits whose first page came from a shared link (?utm_source=share, share-wa, share-copy, share-email). Read by
-- /api/job-kit/stats 'report' as `shares`, shown in the Job Kit's Website stats (Jobs shared).
create or replace function public.rafsite_shares(p_secret text, p_days integer default 30)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  today date := (now() at time zone 'Europe/London')::date;
  since date := today - (least(greatest(coalesce(p_days, 30), 1), 400) - 1);
  out jsonb;
begin
  if not rafsite.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;
  with x as (select * from rafsite.visit_rows(since)),
  t as (
    select split_part(c->>'sh', ':', 1) as how, split_part(c->>'sh', ':', 2) as slug
    from x, jsonb_array_elements(coalesce(x.clicks, '[]'::jsonb)) c
    where coalesce(c->>'sh', '') ~ '^(sheet|wa|copy|email):[a-z0-9-]+$'
  ),
  v as (
    select x.visit, x.visitor, x.created_at, x.ref_kind as kind, x.city, x.region, x.district, x.country,
      case when x.path like '/portfolio/%' then substr(x.path, 12) else x.path end as slug
    from x
    where x.step = 1 and x.ref_kind like 'share%'
  ),
  vv as (
    select v.*,
      (select count(*)::int from x y where y.visit = v.visit) as pages,
      exists (
        select 1 from x y, jsonb_array_elements(coalesce(y.clicks, '[]'::jsonb)) c
        where y.visit = v.visit and coalesce(c->>'g', '') <> ''
      ) as touched
    from v
  ),
  j as (
    select slug, sum(shared)::int as shared, sum(opened)::int as opened
    from (
      select slug, 1 as shared, 0 as opened from t
      union all
      select slug, 0, 1 from vv
    ) u
    group by slug
  )
  select jsonb_build_object(
    'days', today - since + 1,
    'taps', (select count(*)::int from t),
    'how', jsonb_build_object(
      'sheet', (select count(*)::int from t where how = 'sheet'),
      'wa', (select count(*)::int from t where how = 'wa'),
      'copy', (select count(*)::int from t where how = 'copy'),
      'email', (select count(*)::int from t where how = 'email')
    ),
    'visits', (select count(*)::int from vv),
    'people', (select count(distinct visitor)::int from vv),
    'touched', (select count(*)::int from vv where touched),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'shared', shared, 'opened', opened) order by shared + opened desc, slug) from j), '[]'::jsonb),
    'latest', coalesce((
      select jsonb_agg(jsonb_build_object('at', created_at, 'slug', slug, 'kind', kind, 'city', coalesce(city, ''), 'region', coalesce(region, ''), 'district', coalesce(district, ''), 'country', coalesce(country, ''), 'pages', pages, 'touched', touched) order by created_at desc)
      from (select * from vv order by created_at desc limit 20) l
    ), '[]'::jsonb)
  ) into out;
  return out;
end $function$;

revoke all on function public.rafsite_shares(text, integer) from public;
grant execute on function public.rafsite_shares(text, integer) to anon, service_role;
