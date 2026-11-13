-- The daily review (Raf, 12 Nov 2026: "check websites and apps daily see what is happening, make a summary, rethink
-- what happened on that day and suggest what should we change, improve, add to make each website or app better based
-- on data he receives"). Supabase project cabinetos, migration 'jobkit_review'. Every morning the website
-- (src/lib/review-writer.ts) asks 'data' for yesterday's numbers of every app kept in this database, adds ServiceM8's
-- and Vercel's, has Claude write the review and keeps it here. HQ, the Job Kit and CabinetOS's status app read it and
-- mark its ideas. Nothing here is deleted; a mark is its own row, so a review written again keeps them.

create table if not exists jobkit.reviews (
  id text primary key,              -- 'day:YYYY-MM-DD' (a review) or 'mark:<idea id>'
  kind text not null check (kind in ('day', 'mark')),
  state text,                       -- a review: working | ready | failed
  data jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table jobkit.reviews enable row level security;
revoke all on table jobkit.reviews from public, anon, authenticated;

-- Everything this database knows about London day d, and the 7 days before it (summed: the writer divides).
create or replace function jobkit.review_day_data(d date) returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare
  d0 date := d - 7;
  t0 timestamptz := d::timestamp at time zone 'Europe/London';
  t1 timestamptz := (d + 1)::timestamp at time zone 'Europe/London';
  b0 timestamptz := d0::timestamp at time zone 'Europe/London';
  raf jsonb;
  cos jsonb;
  b3 jsonb;
  jk jsonb;
begin
  -- rafcarpentry.com's own visit counter (rafsite.views, a visit = one visitor code's pages under 30 minutes apart)
  with x as (select * from rafsite.visit_rows(d0) where day <= d),
  vis as (
    select visit, day, count(*)::int as n,
           (array_agg(path order by created_at))[1:5] as paths,
           (array_agg(device order by created_at))[1] as device,
           (array_agg(coalesce(ref_kind, 'direct') order by created_at))[1] as src,
           (array_agg(ref_host order by created_at))[1] as host,
           coalesce(sum(engaged_ms), 0)::bigint as engaged
    from x group by visit, day
  ),
  cl as (
    select x.day, x.path, x.visitor, c
    from x cross join lateral jsonb_array_elements(case when jsonb_typeof(x.clicks) = 'array' then x.clicks else '[]'::jsonb end) c
  ),
  tot as (select day, count(distinct visitor)::int as visitors from x group by day)
  select jsonb_build_object(
    'day', jsonb_build_object(
      'visitors', coalesce((select visitors from tot where day = d), 0),
      'visits', (select count(*) from vis where day = d),
      'views', (select count(*) from x where day = d),
      'onePage', (select count(*) from vis where day = d and n = 1),
      'engagedAvgS', (select coalesce(round(avg(engaged) / 1000.0), 0) from vis where day = d),
      'phone', (select count(*) from vis where day = d and device = 'phone'),
      'tablet', (select count(*) from vis where day = d and device = 'tablet'),
      'computer', (select count(*) from vis where day = d and device = 'computer'),
      'saves', (select count(*) from cl where day = d and coalesce(c->>'sv', '') <> '')
    ),
    'before', jsonb_build_object(
      'days', (select count(*) from tot where day < d),
      'visitors', coalesce((select sum(visitors) from tot where day < d), 0),
      'visits', (select count(*) from vis where day < d),
      'views', (select count(*) from x where day < d),
      'onePage', (select count(*) from vis where day < d and n = 1)
    ),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('kind', s.src, 'host', s.host, 'visits', s.n) order by s.n desc)
       from (select src, host, count(*)::int as n from vis where day = d group by 1, 2 order by 3 desc limit 12) s), '[]'::jsonb),
    'sourcesBefore', coalesce((select jsonb_object_agg(s.src, s.n) from (select src, count(*)::int as n from vis where day < d group by 1) s), '{}'::jsonb),
    'goals', coalesce((select jsonb_object_agg(s.g, s.n) from (select c->>'g' as g, count(*)::int as n from cl where day = d and coalesce(c->>'g', '') <> '' group by 1) s), '{}'::jsonb),
    'goalsBefore', coalesce((select jsonb_object_agg(s.g, s.n) from (select c->>'g' as g, count(*)::int as n from cl where day < d and coalesce(c->>'g', '') <> '' group by 1) s), '{}'::jsonb),
    'goalPages', coalesce((select jsonb_agg(jsonb_build_object('goal', s.g, 'path', s.path, 'taps', s.n) order by s.n desc)
       from (select c->>'g' as g, path, count(*)::int as n from cl where day = d and coalesce(c->>'g', '') <> '' group by 1, 2 order by 3 desc limit 10) s), '[]'::jsonb),
    'cards', coalesce((select jsonb_object_agg(s.cd, s.n) from (select c->>'cd' as cd, count(*)::int as n from cl where day = d and coalesce(c->>'cd', '') <> '' group by 1) s), '{}'::jsonb),
    'pages', coalesce((select jsonb_agg(s.p order by (s.p->>'views')::int desc) from (
       select jsonb_build_object(
         'path', x.path, 'title', left(max(x.title), 90), 'views', count(*), 'visitors', count(distinct x.visitor),
         'engagedAvgS', coalesce(round(avg(nullif(x.engaged_ms, 0)) / 1000.0), 0),
         'scrollAvg', round(avg(x.scroll_max)::numeric, 2),
         'entries', count(*) filter (where x.step = 1), 'exits', count(*) filter (where x.next_path is null),
         'viewsBefore', (select count(*) from x x2 where x2.path = x.path and x2.day < d)
       ) as p
       from x where x.day = d group by x.path order by count(*) desc limit 15) s), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object('country', s.country, 'city', s.city, 'district', s.district, 'visits', s.n) order by s.n desc)
       from (select coalesce(country, '?') as country, city, district, count(*)::int as n from x where day = d and step = 1 group by 1, 2, 3 order by 4 desc limit 10) s), '[]'::jsonb),
    'journeys', coalesce((select jsonb_agg(jsonb_build_object('paths', s.paths, 'visits', s.n) order by s.n desc)
       from (select paths, count(*)::int as n from vis where day = d group by 1 order by 2 desc limit 8) s), '[]'::jsonb),
    'blog', jsonb_build_object(
      'reads', coalesce((select jsonb_agg(jsonb_build_object('path', s.path, 'reads', s.n, 'engagedAvgS', s.e, 'scrollAvg', s.sc) order by s.n desc)
         from (select path, count(*)::int as n, round(avg(engaged_ms) / 1000.0) as e, round(avg(scroll_max)::numeric, 2) as sc
               from x where day = d and path like '/blog/%' and coalesce(engaged_ms, 0) >= 5000 group by 1 order by 2 desc limit 10) s), '[]'::jsonb),
      'quickOpens', (select count(*) from x where day = d and path like '/blog/%' and coalesce(engaged_ms, 0) < 5000),
      'readsBefore', (select count(*) from x where day < d and path like '/blog/%' and coalesce(engaged_ms, 0) >= 5000)
    ),
    'games', coalesce((select jsonb_agg(jsonb_build_object('path', s.path, 'views', s.n, 'people', s.p, 'minutes', s.m) order by s.n desc)
       from (select path, count(*)::int as n, count(distinct visitor)::int as p, round(sum(engaged_ms) / 60000.0) as m
             from x where day = d and path like '/tools/games/app%' group by 1 order by 2 desc limit 10) s), '[]'::jsonb),
    'cutlistRequests', (select count(*) from rafsite.cutlist_requests where created_at >= t0 and created_at < t1)
  ) into raf;

  -- CabinetOS (its own tables in this project)
  with svd as (
    select s.*, (s.created_at at time zone 'Europe/London')::date as day
    from public.site_visits s where s.created_at >= b0 and s.created_at < t1
  ),
  vday as (select day, count(distinct visitor)::int as visitors, count(*)::int as views,
                  count(distinct user_id) filter (where user_id is not null)::int as users from svd group by day)
  select jsonb_build_object(
    'visitors', coalesce((select visitors from vday where day = d), 0),
    'views', coalesce((select views from vday where day = d), 0),
    'signedIn', coalesce((select users from vday where day = d), 0),
    'appViews', (select count(*) from svd where day = d and path like '/app%'),
    'before', jsonb_build_object(
      'days', (select count(*) from vday where day < d),
      'visitors', coalesce((select sum(visitors) from vday where day < d), 0),
      'views', coalesce((select sum(views) from vday where day < d), 0),
      'signedIn', coalesce((select sum(users) from vday where day < d), 0),
      'signups', (select count(*) from public.profiles where created_at >= b0 and created_at < t0),
      'projectsNew', (select count(*) from public.projects where created_at >= b0 and created_at < t0)
    ),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', s.src, 'visitors', s.n) order by s.n desc)
       from (select f.src, count(*)::int as n from (
               select coalesce((array_agg(source order by created_at) filter (where source is not null))[1], 'none kept') as src
               from svd where day = d group by visitor) f
             group by 1 order by 2 desc limit 10) s), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', s.path, 'views', s.n, 'visitors', s.v) order by s.n desc)
       from (select regexp_replace(path, '^/pl(/|$)', '/') as path, count(*)::int as n, count(distinct visitor)::int as v
             from svd where day = d group by 1 order by 2 desc limit 15) s), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country', s.c, 'visitors', s.n) order by s.n desc)
       from (select coalesce(country, '?') as c, count(distinct visitor)::int as n from svd where day = d group by 1 order by 2 desc limit 6) s), '[]'::jsonb),
    'devices', coalesce((select jsonb_object_agg(s.dev, s.n) from (select coalesce(device, '?') as dev, count(distinct visitor)::int as n from svd where day = d group by 1) s), '{}'::jsonb),
    'signups', (select count(*) from public.profiles where created_at >= t0 and created_at < t1),
    'signupList', coalesce((select jsonb_agg(jsonb_build_object(
         'plan', p.plan, 'language', p.language,
         'from', (select s2.source from public.site_visits s2
                  where s2.visitor in (select s.visitor from public.site_visits s where s.user_id = p.id) and s2.source is not null
                  order by s2.created_at limit 1),
         'projects', (select count(*) from public.projects pr where pr.user_id = p.id and pr.deleted_at is null),
         'units', (select coalesce(sum(pr.units_count), 0) from public.projects pr where pr.user_id = p.id and pr.deleted_at is null)
       )) from public.profiles p where p.created_at >= t0 and p.created_at < t1), '[]'::jsonb),
    'accounts', (select count(*) from public.profiles where deleted_at is null),
    'paying', coalesce((select jsonb_object_agg(s.plan || ' ' || s.st, s.n) from (
       select plan, subscription_status as st, count(*)::int as n from public.profiles
       where deleted_at is null and subscription_status in ('active', 'trialing', 'past_due') group by 1, 2) s), '{}'::jsonb),
    'projectsNew', (select count(*) from public.projects where created_at >= t0 and created_at < t1),
    'unitsNew', (select coalesce(sum(units_count), 0) from public.projects where created_at >= t0 and created_at < t1),
    'projectsEditedBy', (select count(distinct user_id) from public.projects where updated_at >= t0 and updated_at < t1),
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'what', s.a, 'n', s.n, 'pence', s.pence) order by s.n desc)
       from (select kind, coalesce(meta->>'action', meta->>'step', meta->>'limit', '') as a, count(*)::int as n, coalesce(sum(amount_pence), 0)::int as pence
             from public.admin_events where created_at >= t0 and created_at < t1 and kind <> 'system' group by 1, 2) s), '[]'::jsonb),
    'eventsBefore', coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'what', s.a, 'n', s.n) order by s.n desc)
       from (select kind, coalesce(meta->>'action', meta->>'step', meta->>'limit', '') as a, count(*)::int as n
             from public.admin_events where created_at >= b0 and created_at < t0 and kind <> 'system' group by 1, 2) s), '[]'::jsonb),
    'support', coalesce((select jsonb_agg(jsonb_build_object(
         'from', a.source, 'kind', a.data->'read'->>'kind', 'summary', left(a.data->'read'->>'summary', 220),
         'change', left(a.data->'read'->'change'->>'what', 220), 'urgent', coalesce((a.data->'read'->>'urgent')::boolean, false)))
       from public.admin_insights a
       where a.source in ('mail', 'suggestion') and a.state = 'ready' and a.created_at >= t0 and a.created_at < t1
         and coalesce(a.data->'read'->>'kind', '') not in ('spam', 'automatic', '')), '[]'::jsonb),
    'themes', coalesce((select jsonb_agg(jsonb_build_object('title', t->>'title', 'people', jsonb_array_length(coalesce(t->'keys', '[]'::jsonb)), 'fix', left(t->>'solution', 200)))
       from public.admin_insights a, jsonb_array_elements(coalesce(a.data->'read'->'themes', '[]'::jsonb)) t
       where a.key = 'themes:all' and a.state = 'ready'), '[]'::jsonb),
    'ordersPaid', (select count(*) from public.dfy_orders where paid_at >= t0 and paid_at < t1),
    'ordersPence', (select coalesce(sum(paid_pence), 0) from public.dfy_orders where paid_at >= t0 and paid_at < t1),
    'plannerCutlists', (select count(*) from public.planner_cutlists where created_at >= t0 and created_at < t1),
    'sketchupComputersSeen', (select count(distinct user_id) from public.sketchup_connections where last_seen_at >= t0 and last_seen_at < t1 and revoked_at is null),
    'emailsSent', coalesce((select jsonb_object_agg(s.kind, s.n) from (select kind, count(*)::int as n from public.email_log where created_at >= t0 and created_at < t1 and status = 'sent' group by 1) s), '{}'::jsonb)
  ) into cos;

  -- Build It in 3D's Tell us (b3d.suggestions)
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'who', s.who, 'page', s.page, 'course', s.course, 'lesson', s.lesson, 'text', left(s.body, 300)) order by s.id)
       from (select * from b3d.suggestions where created_at >= t0 and created_at < t1 and kind <> 'rating' order by id limit 12) s), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('course', s.course, 'lesson', s.lesson, 'rating', s.rating, 'n', s.n))
       from (select course, lesson, rating, count(*)::int as n from b3d.suggestions where created_at >= t0 and created_at < t1 and kind = 'rating' group by 1, 2, 3) s), '[]'::jsonb),
    'messagesBefore', (select count(*) from b3d.suggestions where created_at >= b0 and created_at < t0 and kind <> 'rating'),
    'exercisePasses', (select count(*) from public.admin_events where kind = 'sketchup' and meta->>'action' = 'exercise' and created_at >= t0 and created_at < t1)
  ) into b3;

  -- The Job Kit's own records
  select jsonb_build_object(
    'claude', coalesce((select jsonb_agg(jsonb_build_object('feature', s.feature, 'uses', s.n, 'cost', s.c, 'refused', s.r))
       from (select feature, count(*)::int as n, round(sum(cost), 3) as c, count(*) filter (where refused)::int as r
             from jobkit.ai_uses where at >= t0 and at < t1 group by 1) s), '[]'::jsonb),
    'claudeBefore', (select round(coalesce(sum(cost), 0), 3) from jobkit.ai_uses where at >= b0 and at < t0),
    'social', coalesce((select jsonb_agg(jsonb_build_object(
         'platform', p.platform,
         'followers', (select c.followers from jobkit.social_counts c where c.platform = p.platform and c.day <= d order by c.day desc limit 1),
         'weekAgo', (select c.followers from jobkit.social_counts c where c.platform = p.platform and c.day <= d0 order by c.day desc limit 1),
         'dayBefore', (select c.followers from jobkit.social_counts c where c.platform = p.platform and c.day <= d - 1 order by c.day desc limit 1),
         'posts', (select c.posts from jobkit.social_counts c where c.platform = p.platform and c.day <= d order by c.day desc limit 1)))
       from (select distinct platform from jobkit.social_counts) p), '[]'::jsonb),
    'quotesSentMarked', (select count(*) from jobkit.docs where kind = 'mark' and data ? 'quoteSentAt'
       and (data->>'quoteSentAt') ~ '^[0-9]+$' and (data->>'quoteSentAt')::bigint >= extract(epoch from t0) * 1000 and (data->>'quoteSentAt')::bigint < extract(epoch from t1) * 1000),
    'quoteMarks', coalesce((select jsonb_object_agg(id, (data->>'quoteSentAt')::bigint) from jobkit.docs
       where kind = 'mark' and (data->>'quoteSentAt') ~ '^[0-9]+$' and (data->>'quoteSentAt')::bigint > extract(epoch from b0 - interval '120 days') * 1000), '{}'::jsonb),
    'quotesRead', (select count(*) from jobkit.quotes where created_at >= t0 and created_at < t1),
    'designsMade', (select count(*) from jobkit.concepts where created_at >= t0 and created_at < t1),
    'receiptsAdded', (select count(*) from jobkit.costs where id like 'k%' and data is not null and at >= extract(epoch from t0) * 1000 and at < extract(epoch from t1) * 1000),
    'assistantRuns', coalesce((select jsonb_build_object(
         'runs', count(*),
         'emailsRead', coalesce(sum((r->>'mails')::int), 0),
         'jobsMade', coalesce(sum((r->>'made')::int), 0),
         'enquiries', coalesce(sum((r->>'enquiries')::int), 0),
         'problems', coalesce((select jsonb_agg(distinct pr) from jsonb_array_elements(a.data->'runs') r2, jsonb_array_elements_text(coalesce(r2->'problems', '[]'::jsonb)) pr
                               where (r2->>'at')::bigint >= extract(epoch from t0) * 1000 and (r2->>'at')::bigint < extract(epoch from t1) * 1000), '[]'::jsonb))
       from jobkit.assistant a, jsonb_array_elements(coalesce(a.data->'runs', '[]'::jsonb)) r
       where a.id = '_runs' and (r->>'at')::bigint >= extract(epoch from t0) * 1000 and (r->>'at')::bigint < extract(epoch from t1) * 1000
       group by a.data), '{}'::jsonb)
  ) into jk;

  return jsonb_build_object('day', d, 'rafsite', raf, 'cabinetos', cos, 'b3d', b3, 'jobkit', jk);
end;
$f$;

-- The last n days' reviews, newest first, and every mark.
create or replace function jobkit.review_list(n integer) returns jsonb
language sql stable security definer set search_path to '' as $f$
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', substr(r.id, 5), 'state', r.state, 'data', r.data - 'input', 'at', r.updated_at) order by r.id desc)
      from (select * from jobkit.reviews where kind = 'day' order by id desc limit least(greatest(coalesce(n, 14), 1), 60)) r), '[]'::jsonb),
    'marks', coalesce((select jsonb_object_agg(substr(m.id, 6), m.data) from jobkit.reviews m where m.kind = 'mark'), '{}'::jsonb)
  );
$f$;

-- An idea marked: new (no mark), doing (I'll do it), done, no (not for me).
create or replace function jobkit.review_mark(p jsonb, who text) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare
  i text := p->>'id';
  s text := p->>'status';
  out jsonb;
begin
  if i is null or i !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z0-9]{2,20}:[0-9]{1,2}$' then raise exception 'bad id'; end if;
  if s is null or s not in ('new', 'doing', 'done', 'no') then raise exception 'bad status'; end if;
  out := jsonb_build_object('status', s, 'at', (extract(epoch from now()) * 1000)::bigint, 'by', who, 'note', left(coalesce(p->>'note', ''), 300));
  insert into jobkit.reviews (id, kind, data) values ('mark:' || i, 'mark', out)
  on conflict (id) do update set data = excluded.data, updated_at = now();
  return out;
end;
$f$;

create or replace function public.jobkit_review(p_secret text, p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare
  d date;
  r jobkit.reviews;
begin
  if not jobkit.secret_ok(p_secret) then raise exception 'not allowed'; end if;
  if p_action in ('data', 'claim', 'save', 'fail', 'get') then
    d := (p->>'day')::date;
    if d is null or d < date '2026-01-01' or d > (now() at time zone 'Europe/London')::date then raise exception 'bad day'; end if;
  end if;

  if p_action = 'data' then
    return jobkit.review_day_data(d);

  elsif p_action = 'claim' then
    -- one writer at a time; a review that's ready is only written again when asked (force)
    insert into jobkit.reviews (id, kind, state, claimed_at) values ('day:' || d, 'day', 'working', now())
    on conflict (id) do nothing;
    if found then
      return jsonb_build_object('claimed', true, 'had', '{}'::jsonb);
    end if;
    select * into r from jobkit.reviews where id = 'day:' || d for update;
    if r.state = 'working' and r.claimed_at > now() - interval '6 minutes' then
      return jsonb_build_object('claimed', false, 'state', 'working');
    end if;
    if r.state = 'ready' and not coalesce((p->>'force')::boolean, false) then
      return jsonb_build_object('claimed', false, 'state', 'ready');
    end if;
    update jobkit.reviews set state = 'working', claimed_at = now(), updated_at = now() where id = r.id;
    return jsonb_build_object('claimed', true, 'had', r.data);

  elsif p_action = 'save' then
    update jobkit.reviews set state = 'ready', data = coalesce(p->'data', '{}'::jsonb), claimed_at = null, updated_at = now()
    where id = 'day:' || d;
    return jsonb_build_object('ok', true);

  elsif p_action = 'fail' then
    -- a failed rewrite keeps the review it had
    update jobkit.reviews
    set state = case when data ? 'review' then 'ready' else 'failed' end,
        data = data || jsonb_build_object('error', left(coalesce(p->>'error', ''), 300), 'failedAt', (extract(epoch from now()) * 1000)::bigint),
        claimed_at = null, updated_at = now()
    where id = 'day:' || d;
    return jsonb_build_object('ok', true);

  elsif p_action = 'get' then
    return coalesce((select jsonb_build_object('day', d, 'state', state, 'data', data, 'at', updated_at) from jobkit.reviews where id = 'day:' || d), 'null'::jsonb);

  elsif p_action = 'list' then
    return jobkit.review_list((p->>'days')::int);

  elsif p_action = 'mark' then
    return jobkit.review_mark(p, coalesce(nullif(p->>'by', ''), 'jobkit'));
  end if;
  raise exception 'bad action';
end;
$f$;

-- HQ: read the reviews and mark ideas, behind HQ's own secret.
create or replace function public.hq_review(p_secret text, p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $f$
begin
  if not hq.secret_ok(p_secret) then raise exception 'not allowed'; end if;
  if p_action = 'list' then return jobkit.review_list((p->>'days')::int); end if;
  if p_action = 'mark' then return jobkit.review_mark(p, 'hq'); end if;
  raise exception 'bad action';
end;
$f$;

-- CabinetOS's status app (its server, with the service role): the same, for its own part.
create or replace function public.cos_review(p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $f$
begin
  if p_action = 'list' then return jobkit.review_list((p->>'days')::int); end if;
  if p_action = 'mark' then return jobkit.review_mark(p, 'cabinetos'); end if;
  raise exception 'bad action';
end;
$f$;

revoke execute on function jobkit.review_day_data(date), jobkit.review_list(integer), jobkit.review_mark(jsonb, text) from public, anon, authenticated;
revoke execute on function public.jobkit_review(text, text, jsonb), public.hq_review(text, text, jsonb), public.cos_review(text, jsonb) from public, anon, authenticated;
grant execute on function public.jobkit_review(text, text, jsonb), public.hq_review(text, text, jsonb) to anon, service_role;
grant execute on function public.cos_review(text, jsonb) to service_role;
