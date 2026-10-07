# pm-monthly-report — report format

Read at PART B STEP 5. Render only the sections in `report.sections`, in the order below. The shape
comes from real PM status mails: a short verdict first, numbers as **text tables**, then the
observations that explain them — each observation = fact + the PM's reason + what it means next.

## Tone by audience

| Audience | Reader wants | Do | Don't |
|---|---|---|---|
| `client` | Is it on track, what shipped, what do you need from us | Outcome language ("customers can now…"), aggregate numbers, clear asks | Per-person numbers, internal task links, blame, jargon |
| `management` | Team health, risk, forecast | Trends, capacity, risks with owner + mitigation | Long task lists |
| `internal` | Detail to act on | Task links, per-member workload, stale/blocked lists | — |

Language `vi`: Vietnamese prose, keep product/feature names as in the tracker. `en`: plain business
English, short sentences.

Writing rules: one claim per bullet; every "lower/higher" carries the number (`62% (13/21)`, not
"lower"); define units once ("tickets completed per sprint"); a reason only if the PM gave it.

## Sections

### `tldr` — 3 lines max
Overall status (On track / Watch / At risk) + the headline number · the main risk · what we need from
the reader (or "nothing needed"). Written last, placed first.

### `summary` — KPI table + trend
Columns for the current period and up to `forecastWindow` previous ones (from `history`):

| | Sprint 27 | Sprint 28 | **Sprint 29** |
|---|---|---|---|
| Committed | | | |
| Completed | | | |
| Completion rate | | | |
| Unplanned added | | | |
| Carry-over | | | |
| Bugs fixed | | | |

Month cadence: Created / Completed / Open at month end / Overdue instead of Committed. With
`statuses.devDone` add a **Dev done (awaiting release)** row under Completed. A **range** report puts its
own sprints in the columns, then the running sprint as a last column headed `Sprint 33 (forecast)` with
the forecast range and "x done so far" — visibly not a final number. If the previous report forecast a
sprint in this range, add a `Forecast` row (predicted vs actual). Under the table, 1–2 sentences on the
trend direction, with the PM's reason if one was given.

### `goals` — big items
One table, goals with a due date first (soonest first), then the rest:

| Goal | Status | Done | Incl. dev done | Due | Δ since last report |
|---|---|---|---|---|---|
| Customer portal | In progress | 55% (11/20) | 70% | 9 Oct (was 25 Sep) | +15 pts |

`Done` = done/total leaf tickets; with `estimateProgress` add "· 60% by estimate" when estimates are
complete enough. `Due` shows the initial date in brackets when it slipped. Then one bullet per goal that
needs a word: **overdue** (PM's reason + new ETA), **slipped**, **due before the next report** with its
projected %, **on hold** (what it waits for). No reason from the PM → state the fact only. `client`:
goal names as written for the client, no ticket ids or links.

### `highlights` — what was delivered
Grouped by `tracker.groupBy` (or workstream). Each item: feature-level name, one line of value. Merge
sibling tickets into one item; `client` audience never sees ticket ids.

### `workstreams` — long / short term
Two lists (`horizon`). Each: name — status (On track / At risk / Blocked, from PM answer or derived:
overdue/blocked items ⇒ At risk) — next milestone + ETA — owner (not for `client` unless configured).

### `inProgress`
What is mid-flight at period end, with status. Cap at ~8; summarise the rest as a count.

### `quality` — bugs
| New | Fixed | Still open | Escaped to production |
|---|---|---|---|
One line interpreting it — "8 fixed vs 5" is *more fixes*, say so; don't let it read as "more bugs".

### `risks`
Overdue, blocked, stale (> `staleDays` in one status). Each: what, impact, owner, mitigation (from PM).

### `asks` — decisions / support needed
From the PM's STEP 4 answer only. Each: the ask, who, by when. Omit the section if empty.

### `workload` / `time` — never for `client` (CRITICAL 4)
Per member: completed, open, hours (time). Note leave if the PM gave it.

### `forecast` — capacity
Rate = mean completed over the window ÷ `team.size` → "≈ N–M per member, ≈ X per sprint/month".
Adjust for leave the PM reported. State the window used and if the trend is partial.

### `nextPeriod`
Committed / due next period, carry-over items first (they're the ones the reader remembers).

### `notes`
PM's free notes, lightly edited.

## Markdown skeleton

```markdown
# {title or "{name} — {period label} report"}
_{from} → {to} · {timezone} · generated {date}_

## TL;DR
…
## Summary
…
(sections in order)

<!-- tlm-pm-metrics {…one line of JSON, see Metrics…} -->
```

## Metrics

Single-line JSON in an HTML comment at the end of the file. `profiles.mjs history` parses it, so keep
the key names exactly:

```json
{"v":1,"profile":"<id>","cadence":"sprint","period":{"key":"sprint:29","from":"2026-09-08","to":"2026-09-21","label":"Sprint 29"},
 "committed":21,"completed":13,"completionRate":0.62,"unplanned":2,"carryOver":8,"created":null,"overdue":3,
 "bugs":{"new":4,"fixed":8,"open":6,"escaped":1},"teamSize":5,"perMember":2.6,"hours":null}
```

A **range** report adds (keep the flat keys as totals of its sprints):
`"period":{…,"firstSprint":30,"lastSprint":32}` — the next run starts at `lastSprint+1`;
`"devDone":5`; `"sprints":[{"n":30,"committed":…,"completed":…,"devDone":…,"completionRate":…,"unplanned":…,"carryOver":…}]`;
`"forecast":{"sprint":33,"low":18,"high":24,"committed":40}` — the next report compares it with the actual;
`"goals":[{"id":"…","name":"…","pctDone":0.55,"pctInclDevDone":0.7,"due":"2026-10-09","initialDue":"2026-09-25","status":"in progress"}]`
— the selection and the baseline for next run's Δ.

`null` for anything not computed (never 0 as a stand-in).

## Email

- **Subject**: profile `email.subject` with `{name}`, `{period}` filled; default
  `{name} — {period} report`.
- **Body** (HTML for Gmail, plain for `text`): `greeting` → one intro line → TL;DR → the `summary`
  table → 3–5 key observations (the PM's reasons) → `asks` → `nextPeriod` headline → "Full report:
  {file name or link}" → next report date → `signoff`.
- Tables as HTML `<table>` with inline styles (no CSS classes, no images — mail clients drop both).
- Shorter than the Markdown: the email is the summary; the file is the record.
