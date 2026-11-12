-- HQ reads the Job Kit assistant (12 Nov 2026, migration 'hq_assistant'): what it found and did in the last 14 days,
-- its last run and switches. Read only, behind HQ's own secret (hq.secret_ok). The assistant itself writes
-- jobkit.assistant through public.jobkit_assistant (rafcarpentry, migration 'jobkit_assistant').
create or replace function public.hq_assistant(p_secret text)
returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
  if not hq.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'data', x.data, 'at', (extract(epoch from x.at) * 1000)::bigint) order by x.at desc)
      from (select * from jobkit.assistant where id !~ '^_' and at > now() - interval '14 days' order by at desc limit 60) x), '[]'::jsonb),
    'run', coalesce((select data from jobkit.assistant where id = '_run'), '{}'::jsonb),
    'runs', coalesce((select data->'runs' from jobkit.assistant where id = '_runs'), '[]'::jsonb),
    'settings', coalesce((select data from jobkit.assistant where id = '_settings'), '{}'::jsonb),
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint);
end;
$$;
revoke all on function public.hq_assistant(text) from public;
grant execute on function public.hq_assistant(text) to anon, service_role;
