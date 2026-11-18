# Review findings: technical, requirement, or record

> **Applies to**: every review of a change — self-review, an automated review pass, cross-review, PR comments, and
> a QC bug written up as a finding. Stack-independent: the class of a finding does not depend on the
> language.

**Rule (MUST):** label every review finding with exactly one class before you report it —
**TECHNICAL**, **REQUIREMENT** or **RECORD** — and group the report by class. Severity says *how bad*;
the class says *who can fix it* and *what they need first*.

**Why (the failure it prevents):** an unclassified list is triaged as one pile. The developer clears the
technical items because those are the ones they can act on alone; the requirement items sit unanswered
because nobody noticed they need the BA; the record items are waved off as "just docs" — and the next
agent then enforces the stale doc as if it were the rule. The reverse error is just as common: a
disagreement about *what the product should do* gets argued as if it were a code-quality opinion, so the
loudest reviewer wins instead of the person who owns the requirement.

---

## The three classes

| Class | The test | Who can fix it |
|---|---|---|
| **TECHNICAL** | The code does not do what **its own author** intended, or it breaks a convention or invariant of the stack. Findable from the diff and the rules alone — no ticket needed. | The developer, in this branch |
| **REQUIREMENT** | The code does what the author intended, but that differs from a **written requirement** — ticket, spec, design decision, PO/BA answer. Findable only by holding the diff against that requirement. | The developer **if** the requirement is unambiguous; otherwise the BA/PO decides first |
| **RECORD** | The code is right; the **written record** is wrong or missing — doc, spec, ticked task, code comment, test name. Fixing it changes no behaviour. | The developer, in this branch. Not optional |

A finding belongs to exactly one class. When two fit, pick the one whose *fix* is bigger: a crash caused
by a misread requirement is still TECHNICAL, because the crash has to go whatever the requirement says.

---

## Q&A — which class is this?

**Q. The screen throws, leaks, races, double-fetches, or loses keyboard focus.**
TECHNICAL. No requirement anywhere says "do not throw"; the author did not intend it either.

**Q. A convention is broken — naming, DI, BEM/namespace, the accessible name of a control, an enum not
validated at the action, a test that reads the host clock.**
TECHNICAL. The convention *is* the requirement here, and it is written in the rules, not in the ticket.
Cite the rule file and line, not an opinion.

**Q. A behaviour change ships without a test that fails when the change is reverted.**
TECHNICAL. The repo rule is the requirement.

**Q. The ticket or spec says X and the code does Y.**
REQUIREMENT. Quote the line. If both readings are defensible, it is a **question for the BA**, not a
finding to fix quietly in the branch.

**Q. Two screens the ticket says should behave alike behave differently.**
REQUIREMENT — unless the difference is a crash or a convention breach, which is TECHNICAL.

**Q. The design doc and the code disagree, and either could be the right one.**
REQUIREMENT, and the finding's fix is **"decide"**, not "change the code". Say which way you lean and why,
then let the owner answer.

**Q. A doc, spec, task or comment names a symbol, file or test method that does not exist.**
RECORD.

**Q. A task is ticked `[x]` but its own text says an item is still open.**
RECORD. Severity low, but it is the item that makes a reviewer trust a false "done".

**Q. A comment claims something is unreachable / verified / equivalent, and it is not.**
RECORD. A claim in a comment is part of the record.

**Q. It is ugly, or I would have written it differently.**
Not a finding. Drop it.

---

## What the class changes in the report

- **TECHNICAL** — fix in the same branch. Nothing to ask.
- **REQUIREMENT** — quote the requirement line next to the finding. If it is ambiguous, the finding's fix is
  a question on the ticket, and the PR description says the item is open. Do **not** let it be re-labelled a
  nit because it is cheap to change.
- **RECORD** — fix in the same branch; the repo rule is that knowledge files are true in the same PR that
  made them wrong. A record fix never waits for a follow-up ticket.

State the per-class counts in the report. They are a check on the review itself:

- all TECHNICAL → nobody read the ticket;
- all REQUIREMENT → nobody read the code;
- no RECORD at all, on a change that touched behaviour → the docs were not checked.

---

## Worked example (one real 23-finding review)

**TECHNICAL (9)** — the developer fixes them in the branch, nothing to ask:

- a regroup disposes the open select mid-handler; focusing the removed trigger raises an unhandled exception
- the sibling report loses keyboard focus on the same path
- `aria-label` on the control replaces its text, so the current value is never announced
- a date guard reads the host clock instead of the injected `TimeProvider`, so its tests rot on a fixed date
- two behaviour changes whose guard can be deleted with the suite still green
- an enum value no route validates now throws in the exporter: 500 where a 400 belongs
- a loading skeleton drawn under the real header it stands for
- an exact-instant assertion missing on one side of a prefilled range

**REQUIREMENT (6)** — each quotes a written line, or asks for a decision:

- changing the vehicle after a run does not raise the "filters changed" notice, though the spec names the
  vehicle among the fields that must raise it
- one report hides that notice while a regroup loads; its twin was given a fix for exactly that case
- a one-day range arriving from a link hides the day chips without resetting them, against the design decision
- the redesigned panel shows **no** day chips at all until a range is picked, where both sibling panels show
  them — the design added the empty state without saying what this field does in it (**decide**)
- the design says the run button is disabled; it never is — either could be the intended one (**decide**)
- a link whose range is refused silently drops its dates, where the sibling page fills them in

**RECORD (8)** — comments, docs, specs and ticked tasks that no longer match the code, including a task
ticked `[x]` whose own text says an item is still open, and three citations naming test methods that do
not exist.

Counts: **9 technical, 6 requirement, 8 record** — a spread that says the ticket *and* the code *and* the
docs were all read. One class at 23 would have said the opposite.
