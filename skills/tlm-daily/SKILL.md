---
name: tlm-daily
description: Daily ticket health check for the whole team on the tracker (ClickUp) — finds tickets deployed to staging that still have open subtasks, in-progress / pending tickets past their due date, and to-do parent tickets with no due date, groups them by assignee, then asks the lead ticket by ticket what to do (update the status / due date directly, or comment and tag the assignee) and applies only what was approved. TRIGGER on "/tlm-daily", "daily check", "daily ticket check", "check ticket hôm nay", "check status ticket", "rà ticket", "kiểm tra ticket team", or /tlm-daily [me | <member name>].
---

Every morning, one command: pull the team's open tickets, flag the ones that break the team process,
ask the lead what to do with each, and write back only what was approved.

**Pre-flight → Fetch (few calls) → Check → Show by assignee → Q&A per flagged ticket → Preview → Apply**

**Input**: nothing (whole team), `me` (only tickets assigned to the caller), or a member's name.

---

## Why these three checks

| # | Check | The failure it catches |
|---|-------|------------------------|
| 1 | Ticket in a **staging** status with **open subtasks** | The parent says "on staging" while a bug or QA subtask is still open. QC treats it as verified, and it ships with a known bug. |
| 2 | Ticket **in progress / pending** past its **due date** | A slipping ticket nobody re-planned. The lead learns about it at the sprint review, too late to move people. |
| 3 | **To-do** parent ticket with **no due date** | It can't be planned or forecast, and it quietly falls out of the sprint. |

Nothing else is flagged. A check the team didn't ask for is noise that trains people to skip the list.

---

## PHASE 0 — PRE-FLIGHT

Read `tlm.tickets` and `tlm.daily` from `.claude/settings.local.json` (fallback `.claude/tlm.local.json`).
Key meanings: `<rulesRoot>/setup/tlm-config.reference.json` → `tlm.daily`.

- `tlm.tickets.enabled` must be true and `tlm.tickets.system` must be `clickup` (the only adapter so far).
  Any other system → stop with "tlm-daily has no `<system>` adapter yet".
- Confirm the ClickUp MCP is reachable (**ToolSearch** `clickup_filter_tasks`). Unreachable, or it
  returns a rate-limit / auth error → **stop** and say which. Never guess ticket state.
- **`tlm.daily` missing or incomplete** → set it up inline (below), persist it, then continue.
- Call `clickup_get_user` once: its `current_time` and timezone define **today**. Never use your own
  clock — the lead's ClickUp timezone decides what is overdue.

### Inline setup (first run only)

Ask in **one** `AskUserQuestion` round where possible, then persist to `tlm.daily`:

1. **Scope** — the lists / folders / space holding the team's tickets. Accept a pasted ClickUp list or
   folder URL and read the id from it.
2. **Status names** — fetch one ticket in scope, show the board's **real** status list, then map:
   `staging`, `inProgress`, `pending`, `todo`, `subtaskDone`. Each is an array (a board may have two
   staging statuses). Never type a status name from memory: a wrong name filters to zero tickets and
   the check reports "all clear".
3. **Excluded lists** — backlog or icebox lists to skip (optional).

Defaults that need no question: `dueDateRequiredFor: "parent"`, `overdueStatuses: ["inProgress",
"pending"]`, `defaultAction: "ask"`.

---

## PHASE 1 — FETCH (keep the call count low)

The ClickUp MCP has a **daily call limit**. A run that hits it mid-way leaves half the updates applied.
So:

1. **One** `clickup_filter_tasks` (follow `next_page` until `has_more` is false) with the scope ids,
   `statuses` = every name in `staging + inProgress + pending + todo`, `subtasks: false`,
   `fields: ["status", "assignees", "due_date", "date_updated", "list"]`.
   Drop tickets in `excludeListIds`. With `me` / a name, add `assignees`.
   If `dueDateRequiredFor` is `"all"` or check 2 should cover subtasks, run it with `subtasks: true`.
2. **Subtasks only for staging tickets** — check 1 needs each staging ticket's subtasks and their
   statuses. Fetch them in one bulk call when the server has one (`clickup_get_operators` once →
   `task.get_many`), otherwise one `clickup_get_task` per staging ticket. Never fetch subtasks for the
   other tickets.

Report the call count at the end of the run.

---

## PHASE 2 — CHECK

Using today from PHASE 0:

- **Check 1** — status in `staging` AND at least one subtask whose status is **not** in `subtaskDone`.
  List the open subtasks (name + status).
- **Check 2** — status in `inProgress` or `pending` AND due date set AND due date **before today**.
  Show days overdue.
- **Check 3** — status in `todo` AND no due date AND it is a parent/top-level ticket (or any ticket
  when `dueDateRequiredFor` is `"all"`).

A ticket can hit more than one check; show it once with all its flags.

---

## PHASE 3 — SHOW, GROUPED BY ASSIGNEE

One section per assignee (unassigned last), one row per flagged ticket:

```
### <Assignee> — <n> flagged
| Ticket | Status | Due | Flag |
|--------|--------|-----|------|
| [<name>](<url>) | deployed to staging | — | 2 open subtasks: <a> (to do), <b> (in progress) |
| [<name>](<url>) | in progress | <date> (3 days overdue) | Overdue |
| [<name>](<url>) | to do | — | No due date |
```

Then one summary line: `<n> flagged of <m> open tickets · <k> people`. If nothing is flagged, say so
and stop — no Q&A.

---

## PHASE 4 — Q&A PER FLAGGED TICKET

`AskUserQuestion`, up to four tickets per round, assignee by assignee. Options per check (the lead can
always answer "Other" with free text):

| Check | Options |
|-------|---------|
| 1 — staging with open subtasks | Close the open subtasks (they are done) · Move the ticket back to `inProgress` · Remind the assignee · Skip |
| 2 — overdue | New due date (ask the date) · Move to `pending` (ask the blocker) · Remind the assignee · Skip |
| 3 — no due date | Set due date (ask the date) · Remind the assignee · Skip |

- **Remind the assignee** = a comment on the ticket that tags them and says what is missing (e.g.
  "This ticket is past its due date (<date>). Please update the due date or the status and leave a
  short comment."). It changes nothing else.
- **Move to `pending`** → ask what the blocker is and who must confirm; the comment states it and tags
  the leads in `tlm.daily.leads`.
- A date the lead gives in words ("thứ 6", "next Monday") is converted from the ClickUp `current_time`,
  and shown back as `YYYY-MM-DD` in the preview.

Write comments in `tlm.tickets.commentLanguage` (default `en`), short, no emojis.

---

## PHASE 5 — PREVIEW, CONFIRM, APPLY

Show every change before writing anything:

```
Status   [<ticket>](<url>)  deployed to staging → in progress
Due date [<ticket>](<url>)  — → 2026-11-04
Close    [<subtask>](<url>) to do → <subtaskDone[0]>
Comment  [<ticket>](<url>)  @<assignee> "…"
```

One confirmation for the whole batch (the lead may drop lines). Then:

- **Status + due date changes** — together in one `clickup_execute_operator` `task.update_many` call
  (read its parameters with `clickup_get_operators` first). Fall back to `clickup_update_task` per
  ticket only if the operator is not enabled.
- **Comments** — `clickup_create_task_comment`, one per ticket, tagging the assignee by user id when the
  tool supports mentions, else by name.

Then re-read the changed tickets in one `clickup_filter_tasks` and report what actually landed. A
write that failed is reported with its ticket, never retried silently.

---

## PHASE 6 — REPORT

```
tlm-daily · <date> · <scope>
Flagged: <n> (staging+subtasks <a> · overdue <b> · no due date <c>)
Applied: <x> status · <y> due date · <z> subtasks closed · <w> reminders
Skipped: <s>
ClickUp calls: <count>
```

---

## RULES

- **Nothing is written without the lead's confirmation** in PHASE 5. Status changes and comments are
  visible to the whole team.
- Status names come from `tlm.daily.statuses`, read verbatim from the board — never typed from memory.
- Never change a ticket's assignee, priority or description. Only status, due date, subtask status and
  comments.
- Never invent a cause for an overdue ticket. If the lead doesn't know, the action is "Remind the
  assignee".
- Ticket links are markdown links with the ticket name as text, never bare URLs.
- A rate-limit error mid-run → stop, report what was and wasn't applied, and don't retry.
