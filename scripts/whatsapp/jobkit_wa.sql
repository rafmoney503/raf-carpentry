-- public.jobkit_wa: the Job Kit's live WhatsApp store (Supabase cabinetos project, uzrnnnnfdrqunyrysodz).
-- A copy of the live function. Migrations: 'jobkit_wa', 'jobkit_wa_grants' (13 Nov 2026), 'jobkit_wa_read_limits'
-- (19 Nov 2026: Claude reads a chat by itself at most once an hour and at most 10 chats a UK day; a tap on
-- Read it with Claude / Read it again isn't held back or counted). Change it here and apply the whole function.
CREATE OR REPLACE FUNCTION public.jobkit_wa(p_secret text, p_action text, p jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m jsonb;
  w text := p->>'wa';
  r bigint;
  n int := 0;
  since bigint := coalesce((p->>'since')::bigint, 0);
  lim int := least(greatest(coalesce((p->>'limit')::int, 1500), 1), 3000);
  days int := least(greatest(coalesce((p->>'days')::int, 30), 1), 400);
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  a bigint;
  out_msgs jsonb;
  top bigint;
  q jobkit.wa_chats%rowtype;
  -- reads Claude starts by itself: at most read_cap a UK day, and a chat at most once every read_gap
  read_cap int := 10;
  read_gap interval := interval '1 hour';
  today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD');
  auto_n int;
begin
  if not jobkit.secret_ok(p_secret) then
    raise exception 'not allowed';
  end if;

  if p_action = 'put' then
    for m in select * from jsonb_array_elements(coalesce(p->'msgs', '[]'::jsonb)) loop
      if coalesce(m->>'wa', '') !~ '^\d{6,16}$' or coalesce(m->>'id', '') = '' or length(m->>'id') > 200
         or m->>'dir' not in ('in', 'out') or (m->>'at') is null then
        continue;
      end if;
      r := nextval('jobkit.wa_rev');
      insert into jobkit.wa_msgs as x (id, wa, dir, src, at, type, body, media, rev)
      values (m->>'id', m->>'wa', m->>'dir', coalesce(m->>'src', 'live'), to_timestamp((m->>'at')::bigint / 1000.0),
              coalesce(m->>'type', 'text'), left(m->>'body', 8000), m->'media', r)
      on conflict (id) do update set
        body = coalesce(excluded.body, x.body),
        media = coalesce(excluded.media, x.media),
        type = case when excluded.type in ('placeholder', 'unsupported') then x.type else excluded.type end,
        src = case when x.src in ('live', 'echo', 'api') then x.src else excluded.src end,
        rev = r;
      insert into jobkit.wa_chats as c (wa, last_at, last_in_at, live_in_at, rev, touched_at)
      values (m->>'wa', to_timestamp((m->>'at')::bigint / 1000.0),
              case when m->>'dir' = 'in' then to_timestamp((m->>'at')::bigint / 1000.0) end,
              case when m->>'dir' = 'in' and coalesce(m->>'src', 'live') = 'live' then to_timestamp((m->>'at')::bigint / 1000.0) end, r, now())
      on conflict (wa) do update set
        last_at = greatest(c.last_at, excluded.last_at),
        last_in_at = greatest(c.last_in_at, excluded.last_in_at),
        live_in_at = greatest(c.live_in_at, excluded.live_in_at),
        rev = r, touched_at = now();
      n := n + 1;
    end loop;
    for m in select * from jsonb_array_elements(coalesce(p->'contacts', '[]'::jsonb)) loop
      if coalesce(m->>'wa', '') !~ '^\d{6,16}$' then
        continue;
      end if;
      r := nextval('jobkit.wa_rev');
      insert into jobkit.wa_chats as c (wa, name, profile, rev)
      values (m->>'wa', nullif(left(m->>'name', 120), ''), nullif(left(m->>'profile', 120), ''), r)
      on conflict (wa) do update set
        name = case when m ? 'name' then nullif(left(m->>'name', 120), '') else c.name end,
        profile = coalesce(nullif(left(m->>'profile', 120), ''), c.profile),
        rev = case when c.name is distinct from coalesce(nullif(left(m->>'name', 120), ''), c.name)
                     or c.profile is distinct from coalesce(nullif(left(m->>'profile', 120), ''), c.profile) then r else c.rev end;
    end loop;
    for m in select * from jsonb_array_elements(coalesce(p->'statuses', '[]'::jsonb)) loop
      update jobkit.wa_msgs set status = left(m->>'status', 20), rev = nextval('jobkit.wa_rev')
       where id = m->>'id' and status is distinct from left(m->>'status', 20);
    end loop;
    if p ? 'event' then
      insert into jobkit.wa_meta (key, value, at) values ('last_event', p->'event', now())
        on conflict (key) do update set value = excluded.value, at = now();
    end if;
    if random() < 0.02 then
      update jobkit.wa_files set bytes = '\x'::bytea, mime = 'gone' where at < now() - interval '90 days' and mime <> 'gone';
      update jobkit.wa_msgs x set file = null, rev = nextval('jobkit.wa_rev')
       where x.file is not null and exists (select 1 from jobkit.wa_files f where f.id = x.id and f.mime = 'gone');
    end if;
    return jsonb_build_object('ok', true, 'n', n);

  elsif p_action = 'file-put' then
    if coalesce(p->>'id', '') = '' or p->>'mime' not in ('image/jpeg', 'application/pdf')
       or octet_length(coalesce(p->>'b64', '')) > 6000000 or octet_length(coalesce(p->>'thumb', '')) > 40000 then
      raise exception 'bad doc';
    end if;
    insert into jobkit.wa_files (id, mime, bytes) values (p->>'id', p->>'mime', decode(p->>'b64', 'base64'))
      on conflict (id) do update set mime = excluded.mime, bytes = excluded.bytes, at = now();
    update jobkit.wa_msgs set file = case when p->>'mime' = 'application/pdf' then 'pdf' else 'photo' end,
      thumb = nullif(p->>'thumb', ''), rev = nextval('jobkit.wa_rev')
     where id = p->>'id';
    update jobkit.wa_chats c set touched_at = now() where c.wa = (select x.wa from jobkit.wa_msgs x where x.id = p->>'id');
    return jsonb_build_object('ok', true);

  elsif p_action = 'file-get' then
    return coalesce((select jsonb_build_object('mime', f.mime, 'b64', encode(f.bytes, 'base64'), 'wa', x.wa, 'dir', x.dir,
                       'name', x.media->>'name', 'at', (extract(epoch from x.at) * 1000)::bigint)
                     from jobkit.wa_files f join jobkit.wa_msgs x on x.id = f.id
                     where f.id = p->>'id' and f.mime <> 'gone'), 'null'::jsonb);

  elsif p_action = 'msg' then
    return coalesce((select jsonb_build_object('id', x.id, 'wa', x.wa, 'dir', x.dir, 'type', x.type, 'media', x.media, 'file', x.file,
                       'at', (extract(epoch from x.at) * 1000)::bigint)
                     from jobkit.wa_msgs x where x.id = p->>'id'), 'null'::jsonb);

  elsif p_action = 'pull' then
    select coalesce(jsonb_agg(z order by (z->>'rev')::bigint), '[]'::jsonb) into out_msgs from (
      select jsonb_build_object('id', x.id, 'wa', x.wa, 'dir', x.dir, 'src', x.src,
               'at', (extract(epoch from x.at) * 1000)::bigint, 'type', x.type, 'body', x.body,
               'media', case when x.media is null then null else jsonb_build_object('mime', x.media->>'mime', 'name', x.media->>'name', 'caption', x.media->>'caption') end,
               'file', x.file, 'thumb', x.thumb, 'status', x.status, 'rev', x.rev) as z
      from jobkit.wa_msgs x join jobkit.wa_chats c on c.wa = x.wa
      where x.rev > since and c.last_at > now() - make_interval(days => days) and x.at > now() - interval '180 days'
      order by x.rev limit lim) s;
    if jsonb_array_length(out_msgs) >= lim then
      top := (out_msgs->(jsonb_array_length(out_msgs) - 1)->>'rev')::bigint;
    else
      top := coalesce((select max(rev) from jobkit.wa_chats), 0);
      top := greatest(top, coalesce((select max(rev) from jobkit.wa_msgs), 0));
    end if;
    return jsonb_build_object(
      'msgs', out_msgs,
      'chats', coalesce((select jsonb_agg(jsonb_build_object('wa', c.wa, 'name', c.name, 'profile', c.profile,
          'lastAt', (extract(epoch from c.last_at) * 1000)::bigint,
          'lastInAt', (extract(epoch from c.last_in_at) * 1000)::bigint,
          'liveInAt', (extract(epoch from c.live_in_at) * 1000)::bigint,
          'read', c.read, 'readState', c.read_state, 'state', c.state, 'stateAt', c.state_at, 'rev', c.rev))
        from jobkit.wa_chats c
        where c.last_at > now() - make_interval(days => days)
          and ((c.rev > since and c.rev <= top) or c.wa in (select y->>'wa' from jsonb_array_elements(out_msgs) y))), '[]'::jsonb),
      'rev', top,
      'more', jsonb_array_length(out_msgs) >= lim,
      'now', now_ms);

  elsif p_action = 'thread' then
    if coalesce(w, '') !~ '^\d{6,16}$' then
      raise exception 'bad wa';
    end if;
    return jsonb_build_object(
      'msgs', coalesce((select jsonb_agg(z order by z->>'at') from (
        select jsonb_build_object('id', x.id, 'wa', x.wa, 'dir', x.dir, 'src', x.src,
               'at', (extract(epoch from x.at) * 1000)::bigint, 'type', x.type, 'body', x.body,
               'media', case when x.media is null then null else jsonb_build_object('mime', x.media->>'mime', 'name', x.media->>'name', 'caption', x.media->>'caption') end,
               'file', x.file, 'thumb', case when coalesce((p->>'thumbs')::boolean, true) then x.thumb end, 'status', x.status, 'rev', x.rev) as z
        from jobkit.wa_msgs x where x.wa = w order by x.at desc limit least(lim, 600)) s), '[]'::jsonb),
      'chat', (select jsonb_build_object('wa', c.wa, 'name', c.name, 'profile', c.profile,
          'lastAt', (extract(epoch from c.last_at) * 1000)::bigint,
          'lastInAt', (extract(epoch from c.last_in_at) * 1000)::bigint,
          'liveInAt', (extract(epoch from c.live_in_at) * 1000)::bigint,
          'read', c.read, 'readState', c.read_state, 'state', c.state, 'stateAt', c.state_at, 'rev', c.rev)
        from jobkit.wa_chats c where c.wa = w));

  elsif p_action = 'state' then
    if coalesce(w, '') !~ '^\d{6,16}$' or jsonb_typeof(p->'state') <> 'object' or octet_length((p->'state')::text) > 60000 then
      raise exception 'bad doc';
    end if;
    a := least(greatest(coalesce((p->>'at')::bigint, 0), 0), now_ms + 120000);
    update jobkit.wa_chats c set state = p->'state', state_at = a, rev = nextval('jobkit.wa_rev') where c.wa = w and c.state_at < a;
    select * into q from jobkit.wa_chats where wa = w;
    if not found then
      raise exception 'no such chat';
    end if;
    return jsonb_build_object('ok', true, 'state', q.state, 'stateAt', q.state_at);

  elsif p_action = 'read-pending' then
    -- today's reads used up: nothing until the next UK day
    select case when value->>'day' = today then coalesce((value->>'n')::int, 0) else 0 end into auto_n
      from jobkit.wa_meta where key = 'auto_reads';
    if coalesce(auto_n, 0) >= read_cap then
      return '[]'::jsonb;
    end if;
    return coalesce((select jsonb_agg(c.wa order by c.last_in_at desc) from (
      select c.* from jobkit.wa_chats c
      where c.last_in_at is not null and c.last_in_at > now() - interval '14 days' and c.last_in_at < now() - interval '90 seconds'
        and coalesce(c.touched_at, c.last_in_at) < now() - interval '20 seconds'
        and c.last_in_at > to_timestamp(coalesce((c.read->>'upto')::bigint, 0) / 1000.0)
        and coalesce(c.state->>'hidden', 'false') <> 'true'
        and not (c.read_claim is not null and c.read_claim > now() - read_gap)
      order by c.last_in_at desc limit 5) c), '[]'::jsonb);

  elsif p_action = 'read-claim' then
    if coalesce(w, '') !~ '^\d{6,16}$' then
      raise exception 'bad wa';
    end if;
    perform pg_advisory_xact_lock(hashtext('jobkit.wa:' || w));
    select * into q from jobkit.wa_chats where wa = w;
    if not found or (q.read_state = 'working' and q.read_claim > now() - interval '4 minutes') then
      return jsonb_build_object('ok', false);
    end if;
    if coalesce((p->>'auto')::boolean, false) then
      -- a read Claude starts by itself: not twice within the hour, and one of today's read_cap
      if q.read_claim is not null and q.read_claim > now() - read_gap then
        return jsonb_build_object('ok', false, 'wait', true);
      end if;
      insert into jobkit.wa_meta (key, value, at) values ('auto_reads', jsonb_build_object('day', today, 'n', 0), now())
        on conflict (key) do nothing;
      update jobkit.wa_meta set
        value = jsonb_build_object('day', today, 'n', case when value->>'day' = today then coalesce((value->>'n')::int, 0) + 1 else 1 end),
        at = now()
       where key = 'auto_reads' and (value->>'day' is distinct from today or coalesce((value->>'n')::int, 0) < read_cap);
      if not found then
        return jsonb_build_object('ok', false, 'cap', true);
      end if;
    end if;
    update jobkit.wa_chats set read_state = 'working', read_claim = now(), rev = nextval('jobkit.wa_rev') where wa = w;
    return jsonb_build_object('ok', true);

  elsif p_action = 'read-save' then
    if coalesce(w, '') !~ '^\d{6,16}$' or p->>'state' not in ('ready', 'failed') or octet_length(coalesce(p->'read', '{}'::jsonb)::text) > 20000 then
      raise exception 'bad doc';
    end if;
    update jobkit.wa_chats c set
      read_state = p->>'state',
      read = case when p->>'state' = 'ready' then p->'read' else coalesce(c.read, '{}'::jsonb) || jsonb_build_object('error', p->'read'->'error', 'failedAt', now_ms) end,
      read_claim = now(), rev = nextval('jobkit.wa_rev')
     where c.wa = w;
    return jsonb_build_object('ok', true);

  elsif p_action = 'meta-put' then
    if coalesce(p->>'key', '') !~ '^[a-z_]{2,40}$' or p->>'key' = 'auto_reads' or octet_length(coalesce(p->'value', 'null'::jsonb)::text) > 20000 then
      raise exception 'bad doc';
    end if;
    insert into jobkit.wa_meta (key, value, at) values (p->>'key', p->'value', now())
      on conflict (key) do update set value = excluded.value, at = now();
    return jsonb_build_object('ok', true);

  elsif p_action = 'status' then
    select case when value->>'day' = today then coalesce((value->>'n')::int, 0) else 0 end into auto_n
      from jobkit.wa_meta where key = 'auto_reads';
    return jsonb_build_object(
      'chats', (select count(*) from jobkit.wa_chats),
      'msgs', (select count(*) from jobkit.wa_msgs),
      'inbound', (select count(*) from jobkit.wa_msgs where dir = 'in'),
      'files', (select count(*) from jobkit.wa_files where mime <> 'gone'),
      'fileBytes', (select coalesce(sum(octet_length(bytes)), 0) from jobkit.wa_files),
      'history', (select count(*) from jobkit.wa_msgs where src = 'history'),
      'lastAt', (select (extract(epoch from max(at)) * 1000)::bigint from jobkit.wa_msgs where src <> 'history'),
      'meta', coalesce((select jsonb_object_agg(key, jsonb_build_object('value', value, 'at', (extract(epoch from at) * 1000)::bigint)) from jobkit.wa_meta), '{}'::jsonb),
      'reads', jsonb_build_object('today', coalesce(auto_n, 0), 'cap', read_cap, 'gapMinutes', (extract(epoch from read_gap) / 60)::int,
        'waiting', (select count(*) from jobkit.wa_chats c
          where c.last_in_at is not null and c.last_in_at > now() - interval '14 days'
            and c.last_in_at > to_timestamp(coalesce((c.read->>'upto')::bigint, 0) / 1000.0)
            and coalesce(c.state->>'hidden', 'false') <> 'true')),
      'now', now_ms);
  end if;

  raise exception 'bad action';
end;
$function$;
