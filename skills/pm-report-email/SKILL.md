---
name: pm-report-email
description: Turn a saved PM report (from pm-monthly-report) into the short status e-mail a PM sends to stakeholders — Overall, completed goals, long/short term working items, numbered Key Trends & Observations — with the goals the PM picks, every number taken from the report, and no invented reasons. Writes a Markdown file ready to paste into Gmail (optional Gmail DRAFT, never sent). TRIGGER on "viết mail report", "email report", "mail báo cáo", "status email", "mail cho khách", "draft the report email", or /pm-report-email [<report file> | <profile> [period]].
---

The full report is the record; the e-mail is what stakeholders actually read. It is short, written in
the PM's own house layout, and says only what the report can back. This skill **reads** a finished
report — it never queries the tracker and never recomputes a number.

**Input** (`$ARGUMENTS`):

| Input | Uses |
|---|---|
| a report path (`reports/acme/sprint-30-32.md`) | that file |
| `<profile> [period]` | `node <P>/profiles.mjs output <profile> <period>` → that file; no period → newest report from `profiles.mjs history <profile> 1` |
| nothing | the newest report in the current profile's `outputDir`; none → ask for a path |

`<P>` = `<rulesRoot>/skills/pm-monthly-report` (rulesRoot = `<project>/.claude/tlm-plugin` if it exists,
else `${CLAUDE_PLUGIN_ROOT}`). Layout and a filled example: `<rulesRoot>/skills/pm-report-email/email-template.md`
— **read it before STEP 4.**

No report yet → offer to run `/pm-monthly-report` first. Do not build an e-mail from the tracker directly.

---

## CRITICAL — hold these without a second read

1. **Every number comes from the report** (its tables, its text, or its hidden `tlm-pm-metrics` block).
   A number the report does not have is left out, not estimated.
2. **Never invent a reason.** A drop, a slip, an overdue goal → use the PM's reason from the report or
   from STEP 3; none given → state the fact alone. Same for the "why" lines the template shows.
3. **Never send.** Output is a file (and, if asked, a Gmail **draft**). The PM sends it.
4. **Client tone by default.** No per-person numbers, no internal ticket ids in the text, no blame. A
   ticket link the PM explicitly asks for is fine.
5. **The PM picks the goals.** Never decide on their behalf which goals the reader sees.

---

## STEP 1 — Load

Read the report. Pull: period label and dates, completed per sprint (or per month), the forecast for
the next period, goals table (name, status, done %, due, slip), completed goals, quality numbers,
risks, any custom section (e.g. a cost table), and every `[PM: …]` placeholder still in it. If the
profile is known, read `email` from `profiles.mjs show <profile>` (`to`, `cc`, `greeting`, `signoff`,
`subject`, `mode`) and `report.language` / `report.audience`.

Find the **previous e-mail** for the same profile (`*-email.md` in `outputDir`, newest before this one).
It gives: the recipients' names, the previous forecast to compare against, and last time's
long/short term split — offer that split as the default in STEP 2.

## STEP 2 — Pick content (one AskUserQuestion round)

- **Goals** — the report's goals as options (in-progress first, then done), grouped ≤4 per question;
  multi-select. Tell the PM they can type extra items in "Other" (a ticket link, a cost goal); resolve
  those against the report — an item the report does not cover gets its status from the report's
  text only, else ask for one line.
- **Long vs short term** — propose the split (previous e-mail's split, else: goals with a due date more
  than one period out or several open milestones = long term; the rest = short term). The PM confirms
  or moves items.
- **Extras** — multi-select from what the report has: per-sprint numbers line, a custom section such
  as cost, production quality, next-period forecast.

## STEP 3 — Reasons (optional, one round)

List the facts that read as "why?" — throughput below forecast, an overdue or slipped goal, a jump or
drop over ~20% — each with its numbers. Reuse an answer already written in the report. Ask the PM for
one line each, skippable. Skipped → the e-mail states the fact only; never fill the gap.

## STEP 4 — Write

Follow `email-template.md`: greeting with the recipients' names (from the previous e-mail or the PM;
fall back to `email.greeting`), two-line intro naming the period and the forecast period, an
`[image: …]` placeholder for the chart, then **Overall**, **Completed goals**, **Long term working
items** (numbered, one line each: name – current state), **Short term working items** (one line),
**Key Trends & Observations** (numbered; each = bold title that states the finding + 1–3 fact lines +
the PM's reason if given), sign-off.

Writing rules: one claim per line; every comparison carries its numbers (`10 / 16 / 16 / 20`); dates as
`2 Oct`; plain business English (or the profile's language); 3–6 observations, ordered by what the
reader cares about most — delivery, goals done, cost/quality, then items to watch last.

Bold the section titles with `**…**` so the PM can paste a Markdown preview into Gmail and keep the
headings. Subject line from `email.subject` (`{name}`, `{period}`), shown above the body.

## STEP 5 — Save and hand over

Show the e-mail in chat, apply the PM's edits, then write `<report stem>-email.md` next to the report
(e.g. `sprint-30-33-email.md`). `email.mode: gmail-draft` and the PM wants it → create a Gmail draft
(HTML: bold headings, numbered lists, no images) with `to`/`cc` from the profile; never send.

Wrap up in a few lines: file path; how to paste it (open the Markdown preview, select, copy — copying
the raw file pastes the `**` markers); which `[image]` to drop in (the report's chart); facts that went
out without a reason because the PM skipped them.
