---
name: pm-monthly-report
description: Build a PM's periodic project report (monthly or per sprint) from the ticket tracker — delivered work, completion and carry-over, unplanned work, bug quality, workstream status, risks, workload, forecast — asks the PM to explain each anomaly instead of guessing, writes it as a Markdown file and prepares an email (Gmail DRAFT, never sent). One PM keeps several report profiles, one per project, in the project's own store (or a per-user store, so it also runs from Claude Desktop with no repo open). TRIGGER on "monthly report", "sprint report", "PM report", "báo cáo tháng", "báo cáo sprint", "report cho khách", "team health report", or /pm-monthly-report [setup | list | edit <profile> | remove <profile> | <profile> [YYYY-MM | sprint:N]].
---

A PM's report is numbers **plus the reason behind them**. The tracker gives the numbers; only the PM
knows why Sprint 29 dropped or why a feature slipped. So this skill fetches and computes everything it
can, then **asks the PM about each anomaly** and writes their answer in — it never invents a cause.

**Commands** (`$ARGUMENTS`):

| Input | Does |
|---|---|
| `setup` | Q&A that creates a new profile (PART A) |
| `list` | `node <S>/profiles.mjs list` |
| `edit <id>` | Load the profile, re-run only the PART A steps the PM wants to change |
| `remove <id>` | Confirm, then `node <S>/profiles.mjs remove <id>` |
| `<id> [period]` | Run a report (PART B). Period: `YYYY-MM`, `sprint:N` or `sprint:N-M`; default = last ended period (`sinceLastReport`: every sprint since the last saved report) |
| nothing | `list`; one profile → offer to run it; none → offer `setup` |

`<S>` = `<rulesRoot>/skills/pm-monthly-report`, where rulesRoot is `<project>/.claude/tlm-plugin` if it
exists, else `${CLAUDE_PLUGIN_ROOT}`. With no project open (Claude Desktop) it is `${CLAUDE_PLUGIN_ROOT}`.

**Store** — first hit wins: `TLM_PM_REPORTS_FILE` → `<project>/.claude/tlm-pm-reports.json` (project
store, committed with the project; project = `TLM_PROJECT_DIR` or cwd — run the script from the project
root) → `~/.claude/tlm-pm-reports.json` (per user, for Desktop with no repo). In a project, setup saves to
the project store (`save --project`) unless the PM wants it per user. With a project store a relative
`outputDir` resolves against the project root — prefer that over an absolute path, so the profile works
on a teammate's machine.
Full schema: `"pmReports"` in `<rulesRoot>/setup/tlm-config.reference.json`; a filled example is
`<S>/profile.example.json`. Section specs, the Markdown skeleton and the email layout:
`<S>/report-format.md` — **read it before PART B STEP 5**.

**No `node`?** (some Desktop setups) Read/write the store JSON directly following the schema, and do the
period arithmetic by hand. Every other step is unchanged.

---

## CRITICAL — hold these without a second read

1. **Never invent a reason.** A drop, a slip, an unplanned item → ask the PM (STEP 4). If they skip,
   state the fact without a cause.
2. **Never send email.** Gmail gets a **draft**; the PM sends it.
3. **Every number comes from a real tracker read in this run**, or from the metrics block of a saved
   report (trend). No estimates presented as data. Paginate every ClickUp list call until
   `has_more:false` — page 1 alone undercounts silently.
4. **Audience `client`** → no per-person numbers (workload/time by member), no internal task links,
   no blame. Aggregate only, unless the PM explicitly says otherwise for this run.
5. **Tracker is required.** No connector, or the verification read fails → stop and say what to connect.
   No numbers-from-memory fallback.

---

## PART A — SETUP (`setup` / `edit`)

Ask in small rounds (AskUserQuestion, ≤4 questions each). Verify each tracker answer with a **real
read** before moving on. Never ask what the store already answers (`edit`: show the current value as
the first option).

**A1. Identity.** Project display name → propose a kebab-case `id`. Check `list` for a clash.

**A2. Tracker.** System (`clickup` is implemented; others: say "no adapter yet" and stop setup). Verify
the connector with `clickup_get_workspace_hierarchy`; if unauthorized, have the PM connect ClickUp
(claude.ai → Settings → Connectors) and retry. Several workspaces → ask which one.

**A3. How the project is managed — let the PM describe it.** Ask an open question:
*"Mô tả ngắn project được quản lý thế nào trong ClickUp: space/folder/list nào, sprint tổ chức ra sao,
có tag hay custom field nào phân biệt project/bug/unplanned không?"* Then **map the description onto
the real hierarchy** (browse it; `clickup_get_custom_fields` for fields) and propose:
- `tracker.scope` — spaceIds / folderIds / listIds;
- `tracker.filters` — tags and/or custom-field filters (combined with scope, AND);
- `tracker.sprints` (only if they use sprints) — one of: `folder` (a Sprint folder, one list per sprint),
  `customField`, `tag` (`tagPattern` like `sprint {N}`), `calendar` (fixed length from an anchor sprint);
- `tracker.bugs` — how a bug is recognised: `tag` | `taskType` | `list` | `customField`, plus optional
  `escapedTag` (bugs found in production);
- `tracker.unplanned` — optional tag that marks unplanned work; without it, "unplanned" = created after
  the period started.
- `tracker.goals` (only if they track goals / big items as tasks) — `listId` of the goal list, optional
  `taskType` (e.g. `Goal`), `progressBy`: `linkedTasks` (tickets linked to the goal) | `subtasks`,
  `estimateProgress` (also weigh by time estimate), optional `initialDueFieldId` (a date field holding the
  originally promised date — makes a slip visible), `pick`: `each-run` (PM ticks goals every run; the
  last run's choice is the default) | `all` | `with-due-date`. Verify on one goal: its linked tickets
  resolve to real tasks.
- With `tracker.sprints.mode: folder`, `excludeListIds` for non-sprint lists in that folder (a Goal or
  Backlog list) — the sprint is resolved from the remaining lists' names.

Show the mapping as a short table, get a yes, then **verify**: one `clickup_filter_tasks` with the scope
+ filters for last month → report the count and 3 sample task names. A count of 0 or obviously wrong
samples → revisit before saving.

**A4. Status vocabulary.** Read the real statuses from the scoped lists. Ask which mean `done`
(delivered), `inProgress`, `review`, `blocked`. Use the board's names verbatim. Optional tiers:
`devDone` (built, waiting for verification/release — reported separately, never folded into `done`) and
`excluded` (e.g. `cancelled` — dropped from every total, not counted as done or carry-over).

**A5. Cadence.** `month` or `sprint` (sprint needs A3's `tracker.sprints`; for `folder`/`field`/`tag`
resolve the last sprint now as a check; for `calendar` run `profiles.mjs period` on the draft).
Sprint cadence can cover a **range**: `report.range: sinceLastReport` = every sprint ended since the last
saved report, `firstSprint` = where the first report starts (ask "which sprint did the last report
cover?" → +1), and `forecastCurrent` (default true) = forecast the sprint still running.

**A6. Sections** — three multi-select questions, defaults pre-described:
- Overview: `tldr`, `summary` (KPI table + trend), `goals` (needs `tracker.goals`), `highlights`, `inProgress`
- Delivery health: `workstreams`, `quality`, `risks`, `asks`
- Team & ahead: `workload`, `time`, `forecast`, `nextPeriod`
then a yes/no for `notes` (free PM notes asked each run).
Each section's dependencies, asked only when picked:
`workstreams` → list of `{name, horizon: long|short, match, owner?}` (match = list id, tag, custom field
value, or a parent task id) · `quality` → A3 `tracker.bugs` · `forecast` → `team.size`, `team.members`
(optional; `"auto"` = distinct assignees of the period's tickets), `forecastWindow` (sprints/months to average, default 3) · `time` → confirm time tracking is
used (`tracker.timeTracking:true`) · `risks` → `staleDays` (default 10).

**A7. Language & audience.** `language` en | vi · `audience` client | management | internal ·
`timezone` (IANA; default the PM's) · optional report `title`.

**A8. Output.** `outputDir` (any folder; inside a repo is fine — suggest `docs/reports/<id>/`) ·
`fileName` (default `{YYYY-MM}.md` / `sprint-{N}.md`).

**A9. Email.** `mode`: `gmail-draft` | `text` (print subject+body to paste) | `off` · `to`, `cc` ·
`subject` template (placeholders `{name}`, `{period}`) · `greeting`, `signoff`. For `gmail-draft`,
check the Gmail connector now (authenticate if needed). If it can't be connected, offer `text` instead —
don't save a mode that can't run.

**A10. Save.** Show the final profile JSON, get a yes, then
`node <S>/profiles.mjs save [--project]` with the JSON on stdin. Errors → fix and retry. Offer a first run now.

---

## PART B — RUN (`<id> [period]`)

**STEP 0 — Load.** `profiles.mjs validate <id>` (errors → offer `edit`), `profiles.mjs show <id>`,
`profiles.mjs period <id> [period]`. For tracker-held sprints (`needsTracker:true`) resolve the sprint
now: `folder` → the folder's lists minus `excludeListIds`, pick the one whose dates/name match (last
ended by default; a name like `Sprint 33 (10/5 - 10/18)` carries the dates); `customField`/`tag` → the
value for sprint N. A **range** (`fromSprint`…`toSprint`) resolves every sprint in it plus, with
`forecastCurrent`, the running one. The period key is `sprint:N-M`. State what you report on, with dates.

**STEP 1 — Pre-flight.** Tracker connector reachable + one real read in scope. Fail → stop (CRITICAL 5).
`profiles.mjs output <id> <key>`: if the file exists, ask overwrite / new suffix / abort.

**STEP 2 — Collect (ClickUp).** All calls use `workspace_id` + scope + filters; paginate fully.
- **Period set** — sprint `folder`: every task of the sprint list (`include_closed:true`). Month or other
  sprint modes: tasks closed in the window (`date_closed_from/to`) ∪ tasks open at the end of it.
- **Completed** = status in `statuses.done` and closed within the window.
- **Committed** (sprint only) = tasks in the sprint at its start, i.e. created before `from` or not
  marked unplanned. **Unplanned** = `tracker.unplanned` tag, else created after `from`.
  Status in `statuses.excluded` → out of every count. **Dev done** = status in `statuses.devDone`.
- **Range** — every number above **per sprint** (one row each); a closed sprint list no longer changes,
  so its counts are final (they match the tracker's sprint dashboard). The running sprint is read too,
  but only for the forecast — never added to velocity.
- **Goals** (if `goals`) — goal tasks in `tracker.goals.listId` (`taskType` if set, `include_closed`).
  `pick: each-run` → show the PM a numbered table (name, status, due) with last run's selection
  pre-ticked (metrics `goals[].id`) and ask which to drop/add, in one message. Per selected goal read
  `linked_tasks` (or `subtasks`); the linked id is the side that is not the goal; skip links to other goals.
  A linked ticket with subtasks counts by its subtasks (leaf tickets). Read the tickets in bulk
  (`clickup_get_operators` → a task get-many operator) rather than one call each. Per goal: total
  (minus excluded), done, devDone, `% done` = done/total, `% incl. dev done`, and with `estimateProgress`
  the same by `time_estimate` (only when ≥ 70% of leaves carry one — otherwise say "estimates
  incomplete"). Due = goal `due_date`; initial = `initialDueFieldId`; `slipped` = due > initial;
  `overdue` = due < today and % done < 100.
- **Carry-over** = in the period set, not done at `to`.
- **Created** = `date_created` within the window (month cadence).
- **Bugs** (if `quality`) — new / fixed / still open / escaped, using `tracker.bugs`.
- **Overdue** = due ≤ `to`, not done. **Blocked** = status in `statuses.blocked`. **Stale** = same
  status longer than `staleDays` (`clickup_get_bulk_tasks_time_in_status`).
- **Workstreams** — tasks matching each `match`: done this period, open, overdue, next due date.
- **Time** (if `time`) — `clickup_get_time_entries` with `assignee:["any"]`, the window, then keep only
  entries on in-scope tasks.
- **Next period** — tasks due in `next.from..next.to` (or the next sprint list).
Keep task name + URL + assignee + status for everything you'll cite.

**STEP 3 — Compute + trend.** Build the metrics object (shape in `report-format.md` §Metrics).
`profiles.mjs history <id> <forecastWindow+1>` → previous periods' metrics for MoM / sprint-over-sprint
deltas and the forecast (mean completed of the window ÷ `team.size` = per-member rate; adjust for leave
the PM reports in STEP 4). Fewer saved reports than the window → say the trend is partial. A range
report's own sprints count toward the window. **Forecast vs actual**: if the previous report forecast a
sprint now in this range (metrics `forecast`), show predicted vs actual. **Running-sprint forecast**:
committed now × mean completion rate of the window (low = min rate, high = max rate), minus what is
already done, given as a range with the days left; goals whose due date falls in it get a projected %.
Goals: delta of `% done` vs the previous report's `goals[]`.

**STEP 4 — Ask the PM (anomalies + inputs).** Detect, then ask in **one** round (skip-able each):
- completion rate < 80%, or completed down > 20% vs the trend mean;
- each unplanned item, and each carry-over item over 3 (group the rest);
- escaped bugs > 0, bugs open rising;
- a workstream with overdue or blocked items → "On track / At risk / Blocked + ETA?";
- each goal past its due date and not 100% → why, and the new ETA; each goal whose due slipped from the
  initial date → why; a goal due before the next report and under ~70% → on track?; a goal on hold →
  what it waits for;
- capacity: leave / holidays / team changes this and next period (for `forecast`);
- `asks` section: decisions or help needed from stakeholders;
- `notes` section: anything else to include.
Present each anomaly with its numbers and task names so the PM answers in one line. Use the answers
verbatim in meaning — tighten wording, never add causes.

**STEP 5 — Write the Markdown.** Read `<S>/report-format.md`, render only `report.sections` in that
order, in `report.language`, toned for `report.audience`. Numbers as text tables (never an image).
End with the hidden metrics block (§Metrics) — next period's trend reads it. Show the PM the report and
apply edits **before** writing; then write to `output.file` (create `outputDir` if missing). If the
folder is in a git repo, offer to commit — don't commit unasked.

**STEP 6 — Email.** Per `email.mode`:
- `gmail-draft` — build subject + HTML body (`report-format.md` §Email: TL;DR first, tables as HTML,
  no images, link/attach nothing internal for `client`). Create the draft with the Gmail connector's
  draft tool, `to`/`cc` from the profile. Connector unavailable → stop this step and offer: connect
  Gmail, or print as `text` this run (and offer to switch the profile).
- `text` — print subject + plain body in a fenced block, ready to paste.
- `off` — skip.

**STEP 7 — Wrap-up.** Report path, draft status (draft link or "printed"), anomalies the PM skipped,
and anything not computed (e.g. trend partial, time tracking empty).
