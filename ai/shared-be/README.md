# Shared Backend Rules — Index

> **Applies to**: any backend — NestJS, Next.js route handlers + Prisma, EF Core (.NET), plain SQL / Supabase. The
> house rules here come first. The vendored ECC rules (`../vendor/ecc/`, MIT, synced by `sync-ecc.mjs`) add depth
> where the house has no rule of its own. They are referenced, not copied into these files.
> Framework-specific routing: NestJS → [`../nestjs/README.md`](../nestjs/README.md).

## House rules (MUST)

| File | Rule |
|---|---|
| [`01-avoid-n-plus-1-queries.md`](./01-avoid-n-plus-1-queries.md) | Load a collection's related data in one round-trip, never with a query per item |
| [`02-mirror-source-property-names.md`](./02-mirror-source-property-names.md) | A pass-through property keeps the source field's name |
| [`03-remove-dead-code.md`](./03-remove-dead-code.md) | Every symbol a change adds needs a consumer in the same change |
| [`04-complex-queries-brainstorm-first.md`](./04-complex-queries-brainstorm-first.md) | For a complex query, propose 2+ shapes and get the user's confirmation before coding |

## Vendored ECC rules (reference, on demand)

| Topic | File |
|---|---|
| REST design: resources, status codes, pagination, errors, versioning | [`api-design`](../vendor/ecc/skills/api-design/SKILL.md) |
| Server patterns: repositories, caching, auth, rate limiting, jobs, logging | [`backend-patterns`](../vendor/ecc/skills/backend-patterns/SKILL.md) |
| Typed errors, retries, circuit breakers, user-facing messages | [`error-handling`](../vendor/ecc/skills/error-handling/SKILL.md) |
| PostgreSQL: indexes, schema, RLS, slow queries (Supabase-based) | [`postgres-patterns`](../vendor/ecc/skills/postgres-patterns/SKILL.md) |
| Migrations: safety checklist, zero-downtime, rollback | [`database-migrations`](../vendor/ecc/skills/database-migrations/SKILL.md) |
| Prisma traps and patterns | [`prisma-patterns`](../vendor/ecc/skills/prisma-patterns/SKILL.md) |
| Evolving an API or event contract across teams | [`contract-first`](../vendor/ecc/skills/contract-first/SKILL.md) |
| Security checklist: input, secrets, auth, uploads, payments | [`security-review`](../vendor/ecc/skills/security-review/SKILL.md), [`rules/common/security.md`](../vendor/ecc/rules/common/security.md) |
| Pre-PR verification loop | [`verification-loop`](../vendor/ecc/skills/verification-loop/SKILL.md) |

## Business-logic work — ECC agents

For a change whose risk is the **logic** (rules, money, matching, state transitions), use these agents.
**Spawn** the plugin agent `ecc:<name>` when the ECC plugin is enabled (`claude plugin install ecc@ecc`). If it
is not enabled, spawn a `general-purpose` agent, give it the vendored file below as its instructions, and
state the scope (files / diff).

| Stage | Agent / skill | Use it to |
|---|---|---|
| Clarify | skill [`intent-driven-development`](../vendor/ecc/skills/intent-driven-development/SKILL.md) | Turn the ask into acceptance criteria and invariants **before** planning. Ambiguity about a business rule goes back to the user; never assume it. |
| Understand | [`code-explorer`](../vendor/ecc/agents/code-explorer.md) | Trace the existing execution path and data flow before changing or fixing it |
| Plan | [`planner`](../vendor/ecc/agents/planner.md) | Step-by-step plan with risks. The plan goes to the user and waits for approval (house rule, same as `ticket-workflow`) |
| Plan (structure) | [`code-architect`](../vendor/ecc/agents/code-architect.md) | Blueprint for a new module: files, interfaces, data flow, build order, all following the repo's own patterns |
| Review | [`silent-failure-hunter`](../vendor/ecc/agents/silent-failure-hunter.md) | Swallowed errors, bad fallbacks, missing propagation. **Always run it on code that moves money or reconciles totals.** |
| Review | [`type-design-analyzer`](../vendor/ecc/agents/type-design-analyzer.md) | Check that business invariants live in the types, not only in comments |
| Review | [`pr-test-analyzer`](../vendor/ecc/agents/pr-test-analyzer.md) | Check that the tests cover the behaviour and edge cases of the rule, not just lines |
| Review | [`database-reviewer`](../vendor/ecc/agents/database-reviewer.md) | SQL, schema, indexes, RLS and migrations on Postgres / Supabase |
| Review | [`typescript-reviewer`](../vendor/ecc/agents/typescript-reviewer.md) | Type safety, async correctness, Node security in TS/JS |

Review agents can run in parallel on the same diff. Fix every CRITICAL/HIGH finding, or have the user waive it,
before the change is called done.

## House overrides

A house rule always wins over an ECC file.

- **Query shape.** ECC's database sections are reference only. N+1 (`01`) and the brainstorm-then-confirm rule for
  complex queries (`04`) still gate the plan.
- **No coverage number.** `verification-loop` and the `planner` checklist target 80%+ coverage. The house has no
  coverage threshold. Report the number, but do not fail a change on it. Tests must cover the acceptance criteria from
  the Clarify step.
- **Migrations follow the project's tool.** For example, a Supabase project uses `supabase migration new` +
  `supabase db push`. Read `database-migrations` for its safety checklist, not for the tool commands.
- NestJS-specific overrides → [`../nestjs/README.md`](../nestjs/README.md#house-overrides).
