# pm-report-email — layout

Read at STEP 4. The layout comes from the PM's own stakeholder mails: short, factual, numbered, a
reason only when the PM gave one.

## Skeleton

```markdown
Subject: {email.subject}

Hi {recipient names},

{One line: which report this follows, the period covered and the period forecast.}
{One line: how the reports continue — e.g. "I will keep following up with these reports to keep you informed about the team's health."}

[image: {the report's chart, e.g. completed tickets per sprint}]

**Overall**

{Headline number with the per-period split.}
{Comparison with the previous forecast / baseline, numbers included.}
{Forecast for the next period, with the per-member rate if the report has it.}

**Completed goals:**
{Comma-separated goal names; a short qualifier in brackets where the report has one.}

**Long term working items:**

1. {Goal} – {current state, one line}
2. …

**Short term working items:**
{Comma-separated items, one line.}

**Key Trends & Observations**

**1. {Finding stated as a claim}**
{1–3 fact lines with numbers.}
{PM's reason, if given.}

**2. …**

{signoff}
--
```

Omit a section the PM did not pick. Long term items are numbered; short term items stay on one line.

## Observation order

1. Delivery trend (completed per period, vs forecast).
2. Goals completed.
3. Cost, quality, or another custom section the report has.
4. Items to watch (overdue, slipped, blocked) — always last, facts only unless the PM gave a reason.

## Filled example (Acme, Sprints 10–13, no reasons given)

```markdown
Hi Alex and Sam,

Following my Sprint 9 email, here is my summary for Sprints 10–13 and the forecast for the upcoming Sprint 14 (3 Mar – 16 Mar).
I will keep following up with these reports to keep you informed about the team's health.

[image: completed tickets per sprint, S7–S13]

**Overall**

The team completed 58 tickets across Sprints 10–13 (11 / 14 / 15 / 18).
Sprint 13 reached 18 tickets, the level we forecast in the last email and the highest since Sprint 7.
For Sprint 14 we expect 15–18 tickets (about 3–4 per developer, with 5 developers).

**Completed goals:**
Push notifications, database upgrade on staging (production planned for next quarter), and the January production issues.

**Long term working items:**

1. Customer portal – phase 1 and milestones 2–3 are on staging, awaiting release
2. Dashboard redesign – Details page on staging, Reports page in progress, now due 30 Mar

**Short term working items:**
Memory leak fix, Settings UI refresh, Payments API integration (in review), and the February customer feedback items (2 of 3 resolved).

**Key Trends & Observations**

**1. Delivery is back at the target level**
Completed tickets went from 11 in Sprint 10 to 14, 15 and then 18 in Sprint 13.
Sprints 10–12 stayed below the ~18 forecast; Sprint 13 is the first sprint to reach it.

**2. Items to watch**
The memory leak fix is at 20% and passed its 14 Feb due date.
The Dashboard redesign has moved from 9 Mar to 30 Mar.

Regards,
<PM name>
--
```

With a reason from the PM, the observation gains one line after the facts, e.g. under a lower
sprint: "Sprint 9's lower completion was mainly due to two unplanned items: the Details page v1 and
the Map card." — the PM's words, tightened, never extended.
