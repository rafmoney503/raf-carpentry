-- Workshop Games rankings (13 Nov 2026, Raf: 'When a player plays the game at the end can you show them their
-- ranking automatically to keep them playing'). A copy of the Supabase migration 'rafsite_game_rank' (cabinetos
-- project). Each finished game keeps only its game, which level / board / day it was ('key'), the London day and one
-- number, higher = better ('v'). Nothing about who played: no name, no visitor code, no IP address.
-- test = true for previews and local runs, so they never mix into the real rankings.

create table if not exists rafsite.game_scores (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  day date not null,
  game text not null check (game ~ '^[a-z]{3,8}$'),
  key text not null check (length(key) between 1 and 24),
  v double precision not null check (abs(v) < 1e9),
  test boolean not null default false
);
alter table rafsite.game_scores enable row level security;
create index if not exists game_scores_find on rafsite.game_scores (game, key, test, day, v);

-- Adds the score, then says where it stands: among today's games of that key ('today') and the last year's ('all').
-- above / below = games better / worse than it; next = the nearest better score and nextAbove the games better than
-- that one (so 'next' gets you place nextAbove + 1).
create or replace function public.rafsite_game_rank(p_secret text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  g text := p->>'game';
  k text := p->>'key';
  t boolean := coalesce((p->>'test')::boolean, false);
  mine double precision := (p->>'v')::double precision;
  d date := (now() at time zone 'Europe/London')::date;
  r_today jsonb;
  r_all jsonb;
  nx double precision;
begin
  if not rafsite.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;
  if g is null or k is null or mine is null or g !~ '^[a-z]{3,8}$' or length(k) not between 1 and 24 or abs(mine) >= 1e9 then
    raise exception 'bad score';
  end if;
  insert into rafsite.game_scores (day, game, key, v, test) values (d, g, k, mine, t);
  -- kept 13 months: now and then the old ones go
  if random() < 0.01 then
    delete from rafsite.game_scores s where s.day < d - 400;
  end if;

  select min(s.v) into nx from rafsite.game_scores s where s.game = g and s.key = k and s.test = t and s.day = d and s.v > mine;
  select jsonb_build_object('of', count(*), 'above', count(*) filter (where s.v > mine), 'below', count(*) filter (where s.v < mine),
                            'next', nx, 'nextAbove', count(*) filter (where nx is not null and s.v > nx))
    into r_today from rafsite.game_scores s where s.game = g and s.key = k and s.test = t and s.day = d;

  select min(s.v) into nx from rafsite.game_scores s where s.game = g and s.key = k and s.test = t and s.day > d - 366 and s.v > mine;
  select jsonb_build_object('of', count(*), 'above', count(*) filter (where s.v > mine), 'below', count(*) filter (where s.v < mine),
                            'next', nx, 'nextAbove', count(*) filter (where nx is not null and s.v > nx))
    into r_all from rafsite.game_scores s where s.game = g and s.key = k and s.test = t and s.day > d - 366;

  return jsonb_build_object('today', r_today, 'all', r_all);
end;
$function$;

revoke all on function public.rafsite_game_rank(text, jsonb) from public;
grant execute on function public.rafsite_game_rank(text, jsonb) to anon, service_role;
