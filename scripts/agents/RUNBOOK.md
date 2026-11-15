# HQ agents: the hourly run

Rafal's HQ (rafal-hq.vercel.app, the `rafal-hq` branch of this repo) has four standing agents: **Money**, **Day
report**, **Growth** and **Sales**. They are this run: the scheduled Claude task "HQ agents", every hour from 7:00 to
21:00 London. Each run checks what is due, does it, and writes the answers back into Supabase, where HQ shows them.
Rafal gives the agents jobs in HQ (Agents, Give a job) and answers what they ask in "Needs you".

Everything goes through the **Supabase connector**, project `uzrnnnnfdrqunyrysodz` (execute_sql). There are no keys in
this session and none are needed.

## Hard rules

- Never pay anything, move money, change a price, change a job in ServiceM8, or send anything to a customer. A message
  for a customer is written for Rafal to send (a need with a WhatsApp link that has **no number**, see below).
- Never write a customer's phone number, email or street into the store. First names (and the surname's initial) only.
- SQL: only `select`, and the `hq.agent_*` helpers below to write. Never DROP, DELETE, TRUNCATE or UPDATE tables yourself.
- Never invent a figure. If the data isn't there, say so in one line ("ServiceM8's snapshot is 3 hours old", "Money pots
  has no balances typed since 30 Oct").
- Words: plain UK English, short sentences, concrete numbers, no dashes (use commas or "to"), no emoji. Money with £ and
  commas (£1,350). Times on London's clock. Talk to Rafal as "you".
- Code changes (Growth): only after Rafal pressed **Do it**, only on a new branch with a preview, and only merged after a
  second need "Merge" that he pressed. Follow the repo's CLAUDE.md (git fetch / rebase onto origin/main first; commit
  attribution lines). One change a run at most.
- Stop starting new work after about 20 minutes; what's left waits for the next run.

## 1. What is due

```sql
select hq.agents_due();
```

It answers `reports` (agent ids whose report is due now), `jobs` (jobs due: id, agent, text, repeat, last answer)
and `doing` (needs Rafal pressed Do it on: id, agent, text, how, action). Nothing in any of them: log the check and stop:

```sql
select hq.agent_run_add(<ms>, '{}'::jsonb);
```

## 2. Before an agent works

Read its settings and notes (what it remembers) and follow them; Rafal's notes (`by = 'raf'`) and `brief` win:

```sql
select id, name, may, brief from hq.agents where id = 'money';
select id, text, by from hq.agent_notes where agent = 'money' and gone_at is null order by at;
```

`may = 'tell'`: it only reports and answers; it makes no Do it needs that would change anything (Done needs for Rafal
are fine).

## 3. Where the facts are

| What | Query |
| --- | --- |
| ServiceM8 jobs (snapshot, every 30 min) | `select data, at from jobkit.context where key = 'business';` `data.jobs[]`: uuid, number, status (Quote, Work Order, Completed, Unsuccessful), name ("Amelia S."), area, what, created, quoteSent, workOrder, completed, lost, total (with VAT), paid, left, paidInFull, payments[{amount, date, deposit}]. `data.bookings[]`: job, start, end. Say how old it is if over 2 hours. |
| Quotes Rafal marked sent on WhatsApp | `select id, (data->>'quoteSentAt')::bigint from jobkit.docs where kind = 'mark' and data ? 'quoteSentAt';` (id = job uuid, ms) |
| Rough quotes (Job Kit Quotes) | `select id, state, data->>'first', data->>'area', edits->>'sentAt', created_at from jobkit.quotes where id not like '\_%' order by created_at desc limit 30;` |
| New enquiries the assistant found | `select id, data from jobkit.assistant where kind = 'enquiry' and at > now() - interval '7 days';` |
| WhatsApp chats Claude read | `select coalesce(name, profile), read->>'kind', read->>'what', read->>'waiting_on', last_in_at from jobkit.wa_chats where last_at > now() - interval '7 days' order by last_at desc;` |
| Money pots | `select kind, id, data from jobkit.pots where data is not null;` kind 'book' id 'settings' (VAT, CT, PAYE, bank balances in `bank`, cushion `buffer`, Self Assessment `sa`), kind 'entry' (money in and out, `pot`, `amount`, `date`, `moved`). Money pots' own sums (totals, bankNow, Safe to spend, the calendar of HMRC dates) are in `src/app/pots/app.html`: work them out the same way and say "as Money pots shows it". |
| Claude credit | `select data from jobkit.ai_settings where id = 'credit';` (balance, warn, at ms) and `select feature, count(*), sum(cost) from jobkit.ai_uses where at > to_timestamp(<credit at>/1000) group by 1;` left = balance less cost since. |
| The daily review | `select id, data->'review' from jobkit.reviews where id like 'day:%' and state = 'ready' order by id desc limit 2;` its `numbers` per app in `data->'numbers'`. |
| Website visits | `select * from rafsite.visit_rows(now() - interval '7 days')` (one row a page view: path, src, country, city, engaged_ms, scroll, goals) |
| Social followers | `select platform, day, followers, posts from jobkit.social_counts order by day desc limit 20;` |
| The sites' code | this repo (raf-carpentry, main), the `rafal-hq` branch, and cabinetos-site / builditin3d when attached. |

## 4. The reports

One report per due agent. A **headline** of one sentence (what matters most today, under 120 characters), up to 6
**numbers** `[{"label","value","hi":true when it needs attention,"note"}]`, a short **body** (2 to 5 sentences: what
changed, what's coming, what you'd do) and a **foot** naming where it came from.

```sql
select hq.agent_report_add('money', '<headline>', '<body>', '<numbers json>'::jsonb, 'From Money pots and ServiceM8.');
```

- **Money** (daily 7:30): money in the last 7 days (ServiceM8 payments), still to collect (left on Completed and on Work
  Order jobs, oldest first), deposits in, HMRC dates in the next 30 days with amounts (Money pots), Safe to spend as Money
  pots works it out, Self Assessment left, Claude credit left. Needs: a payment owed over 7 days after completion
  (a WhatsApp reminder for Rafal to send), a Space to top up (Done), credit under its warn amount (Done: top up).
- **Day report** (daily 7:00): yesterday's daily review in short: its headline, the 4 to 6 numbers that matter from
  `numbers` (business first, then rafcarpentry, CabinetOS), and its open ideas in one line each. Foot "From the daily
  review." No needs unless the review shows something broken.
- **Growth** (Mon, Wed, Fri 9:00): the week's visits, where they came from (Google, ChatGPT, social), top pages, taps to
  get in touch, followers, against the week before; one change worth making (the page, why, the number to watch) as a
  Do it need. Never the same idea twice: check its earlier needs (`select text, status from hq.agent_needs where agent =
  'growth' order by created_at desc limit 20`).
- **Sales** (every 2 hours): new enquiries since the last report (name, area, what, where from), quotes sent with no answer
  for 5 days or more (follow-up needs), Quote jobs with no quote after 2 days, visits booked today and tomorrow, WhatsApp
  chats waiting on Rafal. Skip the report (write nothing) when nothing changed since its last one; still do its jobs.

## 5. Needs (things for Rafal)

```sql
select hq.agent_need_add('<agent>', '<what>', '<how Do it works, one line>', 'do' | 'done', '<action json>'::jsonb);
```

- A message for a customer: button `do`, action `{"open":"https://wa.me/?text=<url-encoded message>","copy":"<message>",
  "label":"Write it in WhatsApp"}`. No number in the link: Rafal picks the chat. The message is short, in his voice
  ("Hi Amelia, ..."), signed "Raf", no prices or dates he hasn't given.
- Something Rafal does himself (move money, top up credit, call someone): button `done`.
- Something the agent does after he agrees (a site change, a longer piece of work): button `do`, action `{}`. When he
  presses it, it comes back in `doing` (step 7).
- The same text isn't added twice while open. When a need no longer applies (paid since, answered since), close it:
  `select hq.agent_need_close(<id>, 'no', 'Paid on 16 Nov, nothing to do.');`

## 6. Jobs Rafal gave

For each job in `jobs`, oldest first, at most 4 a run:

```sql
select hq.agent_job_start(<id>);
-- do it
select hq.agent_job_done(<id>, '<answer>', true);   -- or false with why it couldn't be done
```

The answer is what Rafal reads: the answer first, then the figures behind it, under 1,500 characters, short
paragraphs. A repeating job (every day / every week) gets a fresh answer each time; its last answer is in `answer`.
If the job needs something only Rafal can do, answer what you could and add a `done` need. If it asks for a lasting
rule ("always ...", "from now on ..."), also save it: `select hq.agent_note_add('<agent>', '<the rule>');`

## 7. Do it pressed

For each need in `doing`: do what it said, then close it with what happened:

```sql
select hq.agent_need_close(<id>, 'done', '<what you did, with a link if there is one>');
```

For a site change: make it on a new branch, push, wait for the Vercel preview (READY), then close the need with the
preview link and add a new need "Preview ready: <what changed>. Merge it?" (button `do`, action `{"label":"Merge"}`).
When that one comes back in `doing`: rebase on main, merge (squash), push, check the production deploy is READY, and
close it with "Live: <link>".

## 8. Notes (what it remembers)

Add a note when you learn something lasting (a rule Rafal gave, a fact that changes how you work). Keep each agent to
about 12 notes; never repeat one. Notes by Rafal are never changed by an agent.

## 9. Log the run

```sql
select hq.agent_run_add(<ms>, '{"money":"report","sales":"2 jobs"}'::jsonb, '["ServiceM8 snapshot 5 hours old"]'::jsonb);
```

## The scheduled task

"HQ agents", `CRON_TZ=Europe/London 0 7-21 * * *` (hourly; the server picks the minute), fresh session each run, prompt:

> Run HQ's agents: follow scripts/agents/RUNBOOK.md in the raf-carpentry repo (main) exactly, using the Supabase
> connector on project uzrnnnnfdrqunyrysodz. Start with `select hq.agents_due();` and stop at once if nothing is due.
