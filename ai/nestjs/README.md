# NestJS Backend Rules

> **Applies to**: any NestJS service (`@nestjs/core` in `package.json`, `src/main.ts` calling `NestFactory.create`).
> Routes to the **house rules** first and then to the **vendored ECC rules** in `ai/vendor/ecc/`. The ECC content is
> referenced here, not re-written, so it follows ECC through `sync-ecc.mjs`. See
> [`../vendor/ecc/PROVENANCE.md`](../vendor/ecc/PROVENANCE.md).

## Read order

1. **House backend rules (MUST)**: [`../shared-be/README.md`](../shared-be/README.md). These rules apply to every
   NestJS change: no N+1, carrier properties keep their source names, remove dead code, and brainstorm complex queries
   before writing them.
2. **NestJS structure**: [`../vendor/ecc/skills/nestjs-patterns/SKILL.md`](../vendor/ecc/skills/nestjs-patterns/SKILL.md).
   Covers modules and providers, the global `ValidationPipe`, DTOs, guards, exception filters, config validation,
   transactions and testing.
3. Then read whichever of these the change touches:

| The change… | Read |
|---|---|
| adds or changes an endpoint (routes, status codes, pagination, errors) | [`api-design`](../vendor/ecc/skills/api-design/SKILL.md) |
| adds caching, a queue or job, rate limiting, logging | [`backend-patterns`](../vendor/ecc/skills/backend-patterns/SKILL.md) |
| adds error types, retries or user-facing messages | [`error-handling`](../vendor/ecc/skills/error-handling/SKILL.md) |
| uses Prisma | [`prisma-patterns`](../vendor/ecc/skills/prisma-patterns/SKILL.md) |
| writes SQL, an index or an RLS policy on Postgres | [`postgres-patterns`](../vendor/ecc/skills/postgres-patterns/SKILL.md) |
| adds a migration | [`database-migrations`](../vendor/ecc/skills/database-migrations/SKILL.md) |
| changes a contract another app consumes | [`contract-first`](../vendor/ecc/skills/contract-first/SKILL.md) |
| touches auth, user input, secrets, uploads or payments | [`security-review`](../vendor/ecc/skills/security-review/SKILL.md), plus [`rules/common/security.md`](../vendor/ecc/rules/common/security.md) and [`rules/typescript/security.md`](../vendor/ecc/rules/typescript/security.md) |
| any TypeScript | [`rules/typescript/coding-style.md`](../vendor/ecc/rules/typescript/coding-style.md), [`rules/typescript/patterns.md`](../vendor/ecc/rules/typescript/patterns.md) |
| changes business logic (rules, money, matching, state) | the agent lane in [`../shared-be/README.md`](../shared-be/README.md#business-logic-work--ecc-agents) |
| is done and needs checking before a PR | [`verification-loop`](../vendor/ecc/skills/verification-loop/SKILL.md) |

## House overrides

Where the house disagrees with an ECC file, the house wins. Keep this list current after every ECC sync.

- **Response DTO field names.** ECC says to return dedicated response DTOs, not ORM entities. Keep doing that. A field
  that passes a value through unchanged keeps the source's name. → `../shared-be/02-mirror-source-property-names.md`
- **Relations in a list endpoint.** ECC's repository pattern does not say how to load relations. House rule: load them
  in one round-trip (Prisma `include`/`select`, TypeORM `relations` or a join, or one `IN` query), never per item.
  → `../shared-be/01-avoid-n-plus-1-queries.md`
- **One error envelope per API.** `nestjs-patterns` uses `{ path, error }` in its filter, while
  `rules/typescript/patterns.md` uses `{ success, data, error }`. These are examples, not a mandate. If the service
  already has an envelope, keep it. A new service picks one, records it in its own README, and uses it everywhere.
- **No coverage number.** `verification-loop` targets 80% coverage. The house has taken no position on a coverage
  threshold (see `../vendor/ECC-ADOPTION.md`). Run the tests and report the number, but do not fail a change on it.
- **React-only sections.** `rules/typescript/patterns.md` → "Custom Hooks Pattern" is frontend. Ignore it here.
- **Commit messages and branching** come from `ticket-workflow`, not from ECC.
