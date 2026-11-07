---
name: systematic-debugging
description: Root-cause-first debugging — reproduce, read the full error, gather evidence, test one hypothesis at a time, fix the cause not the symptom, add a regression test. TRIGGER on a bug report, crash, error message, failing test, regression, "doesn't work", "lỗi", "bug", "không chạy", "bị crash", "sửa lỗi", "fix".
---

# Systematic debugging

A fix written before the cause is known usually moves the bug instead of removing it — and each failed
guess leaves edits behind that make the next guess harder. So: **no fix until the cause is proven.**

**Reproduce → Read → Narrow → Hypothesize (one at a time) → Fix the cause → Prove it**

For a hard bug, delegate the investigation to the project's `debugger` agent (see `agent-setup`) so the
dead ends stay out of the main context.

---

## STEP 1 — Reproduce

Get the exact command, steps or input and the exact output. Run it yourself. If you cannot reproduce it,
say what is missing (data, device, env) and ask — do not fix a bug you have not seen.

## STEP 2 — Read the whole error

The full message and stack, down to the **first frame in project code**; open that line and its caller.
Most bugs are in plain sight in the second half of a stack trace nobody read.

## STEP 3 — Narrow

- **What changed?** `git log -p -- <file>`, `git diff <last-good>`; `git bisect` when the range is wide.
- **Which inputs trigger it and which don't?** The difference is the clue.
- **Where does good data turn bad?** Log at the boundaries (request in, parsed, stored, rendered).

## STEP 4 — One hypothesis at a time

State it in one sentence ("the list is empty because the query filters on `status` before the join").
Test it with the **smallest probe** — one log, one test, one REPL call. Keep it or discard it, then the next.
Never change two things at once: when it starts working you will not know which one fixed it.

**Three hypotheses discarded → stop.** Report to the user what you ruled out and the evidence; don't
keep guessing.

## STEP 5 — Fix the cause, then prove it

- Fix where the bad state is *created*, not where it is *noticed* (no `?.` / `try {} catch {}` /
  `|| []` papering over a value that should never be missing).
- If the project has a test runner, write the regression test **first** and watch it fail (see `tdd`).
- Remove every probe you added.

---

## Stack notes — the usual suspects

- **Next.js** — hydration mismatch (server/client render differs: dates, `window`, random ids);
  stale `.next` cache; a server-only import leaking into a client component; env vars without
  `NEXT_PUBLIC_` are `undefined` in the browser.
- **React** — stale closure in an effect/callback; missing dependency; state updated during render.
- **React Native** — stale Metro cache (`--reset-cache`); native module not linked / pods not installed;
  works on iOS not Android (permissions, fonts, `Platform.OS` branches).
- **NestJS** — provider not exported from its module / circular import (`forwardRef`); DTO validation not
  applied (missing `ValidationPipe` / `class-transformer`).
- **Prisma** — client not regenerated after a schema change (`prisma generate`); N+1 from a loop of
  `findUnique`; a migration applied in one env and not another.

---

## Finish

Before reporting done, run the project's checks (typecheck, lint, tests). The `verify-gate` Stop hook
blocks finishing when code was edited and no check ran after the last edit. Report the root cause
(`path:line`), the evidence, the fix, and the test that now guards it.
