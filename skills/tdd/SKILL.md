---
name: tdd
description: Test-first workflow — RED (a failing test, seen failing for the right reason) → GREEN (the smallest change that passes) → REFACTOR, using the runner the project already has. TRIGGER on "tdd", "test first", "viết test", "viết test trước", "write tests", "add unit tests", "reproduce the bug as a test", and for logic-heavy work (utils, validation, services, reducers, API handlers).
---

# TDD

A test you have never seen fail proves nothing — it may not even run. A test written after the code
tends to assert what the code does, not what it should do. Writing it first fixes both.

**Detect the runner → RED → GREEN → REFACTOR → Verify**

---

## STEP 0 — When it fits

**Use it for:** pure logic (utils, formatters, `safeString`-style helpers), Zod schemas and validation,
services / API handlers, reducers and hooks with logic, and every bug fix (the regression test first).

**Skip it for:** pure layout from a Figma design, config, copy changes, throwaway spikes. Say you are
skipping and why — don't silently drop it.

## STEP 1 — Use the runner the project already has

Read `package.json`: `vitest` / `jest` (NestJS ships jest) / `@playwright/test` / `detox`, and the
existing `*.test.*` / `*.spec.*` files for location and style. **Never add a second runner.** No runner at
all → ask before installing one.

Package manager from the lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm. Run a single
file (`pnpm vitest run path/to/x.test.ts`, `pnpm jest path/to/x.spec.ts`) while iterating.

E2E belongs to the plan, not the end — follow `ai/shared-fe/14-e2e-testing.md`.

## STEP 2 — RED

Write one test for one behaviour, named as the behaviour ("returns '-' for null"). Run it. It must fail,
**and fail for the reason you expect** (assertion, not a typo or import error). If it passes, the
behaviour already exists or the test is wrong — find out which.

## STEP 3 — GREEN

The smallest code change that makes it pass. No extra options, no "while I'm here". Run the test again.

## STEP 4 — REFACTOR

With the test green, clean up names and duplication in code *and* test. Run the file again.
Repeat RED → GREEN → REFACTOR for the next behaviour.

---

## Rules

- Test behaviour through the public surface (inputs → outputs, rendered text, HTTP response), not
  private functions or implementation details. No snapshot-only tests.
- Mock only the boundary you don't own (network, time, device); use the project's mock-data rules
  (`ai/shared-fe/13-mock-data.md`).
- **This house sets no coverage threshold** (`ai/vendor/ECC-ADOPTION.md`) — never add one to config or CI.
- Never weaken an assertion or `skip` a test to get green; if a test is wrong, say so and fix it.

## Finish

Run the full check set (typecheck, lint, the whole test suite) before reporting done — the
`verify-gate` Stop hook blocks finishing when code was edited and no check ran after the last edit.
Report the tests added and what each one proves.
