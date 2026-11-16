-- A copy of the Supabase migration 'rafsite_guide_sales' (cabinetos project, applied 16 Nov 2026), for tests on a
-- local Postgres. Guides sold on rafcarpentry.com (the £9.99 IKEA PAX guide first): Stripe's webhook adds a paid
-- Checkout Session, the thank-you page and the emailed link look it up by its session id (a long random secret), and
-- each download is counted (30 at most). Only through public.rafsite_guide with the visit counter's secret.
create table if not exists rafsite.guide_sales (
  session text primary key,
  product text not null default 'pax-guide',
  email text,
  name text,
  amount int,
  currency text,
  link text,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  downloads int not null default 0,
  last_download_at timestamptz
);
alter table rafsite.guide_sales enable row level security;

create or replace function public.rafsite_guide(p_secret text, p_action text, p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  hit rafsite.guide_sales%rowtype;
  n int;
  d int := least(400, greatest(1, coalesce((p->>'days')::int, 30)));
  r jsonb;
begin
  if not rafsite.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;
  if p_action = 'add' then
    insert into rafsite.guide_sales (session, product, email, name, amount, currency, link)
    values (left(p->>'session', 200), coalesce(left(p->>'product', 40), 'pax-guide'), left(lower(p->>'email'), 254),
            left(p->>'name', 120), nullif(p->>'amount', '')::int, left(p->>'currency', 8), left(p->>'link', 80))
    on conflict (session) do nothing;
    get diagnostics n = row_count;
    select * into hit from rafsite.guide_sales s where s.session = p->>'session';
    return jsonb_build_object('ok', true, 'new', n > 0, 'emailed', hit.emailed_at is not null);
  elsif p_action = 'emailed' then
    update rafsite.guide_sales s set emailed_at = now() where s.session = p->>'session';
    return jsonb_build_object('ok', true);
  elsif p_action = 'get' then
    select * into hit from rafsite.guide_sales s where s.session = p->>'session';
    if not found then
      return jsonb_build_object('found', false);
    end if;
    return jsonb_build_object('found', true, 'product', hit.product, 'email', hit.email, 'name', hit.name,
                              'emailed', hit.emailed_at is not null, 'downloads', hit.downloads);
  elsif p_action = 'download' then
    update rafsite.guide_sales s set downloads = s.downloads + 1, last_download_at = now()
     where s.session = p->>'session' and s.downloads < 30
     returning * into hit;
    if found then
      return jsonb_build_object('ok', true, 'product', hit.product, 'downloads', hit.downloads);
    end if;
    select * into hit from rafsite.guide_sales s where s.session = p->>'session';
    return jsonb_build_object('ok', false, 'reason', case when found then 'limit' else 'none' end);
  elsif p_action = 'list' then
    select jsonb_build_object(
      'days', d,
      'sold', (select count(*) from rafsite.guide_sales s where s.created_at > now() - make_interval(days => d)),
      'all', (select count(*) from rafsite.guide_sales),
      'pence', (select coalesce(sum(s.amount), 0) from rafsite.guide_sales s where s.created_at > now() - make_interval(days => d)),
      'recent', coalesce((select jsonb_agg(x order by x.at desc) from (
          select s.created_at as at, s.product, s.email, s.name, s.amount, s.downloads, s.emailed_at is not null as emailed
          from rafsite.guide_sales s order by s.created_at desc limit 50) x), '[]'::jsonb)
    ) into r;
    return r;
  end if;
  raise exception 'bad action';
end $function$;

revoke all on function public.rafsite_guide(text, text, jsonb) from public;
revoke all on function public.rafsite_guide(text, text, jsonb) from authenticated;
grant execute on function public.rafsite_guide(text, text, jsonb) to anon, service_role;
