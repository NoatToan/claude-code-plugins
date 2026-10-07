# Complex Queries — Brainstorm, Then Confirm, Then Write (Shared Backend)

> **Applies to**: any backend change that adds or reshapes a non-trivial database query — any ORM, query
> builder or raw SQL, in any language. Cross-stack backend rule, the backend counterpart to
> `ai/shared-fe/`. Companion of [`01-avoid-n-plus-1-queries.md`](./01-avoid-n-plus-1-queries.md).

**Rule (MUST):** before writing a **complex** query, stop and **brainstorm at least two query shapes**,
compare them, and **get the user's confirmation on the chosen approach** — *then* implement. Never ship a
complex query as the first shape that compiled. A simple query (single table, filtered by an indexed key,
small bounded result) needs no ceremony.

**And always (no exception): no N+1.** Every query you write — simple or complex — loads a collection's
related data in one round-trip (see [`01`](./01-avoid-n-plus-1-queries.md)). A query per item inside a loop
is a defect, not a style choice.

**Why (the failure it prevents):** complex queries are where the data layer silently does the expensive
thing — a group-by the ORM evaluates as N sub-queries, an eager-load chain that explodes into a cartesian
product, an `IN` list of 20,000 ids, a filter on a non-indexed column of a multi-million-row table, a
recursive walk issued per node. They pass review because the code reads cleanly and pass tests because the
test DB has 10 rows. The cost shows up in production as a slow endpoint, a pegged DB CPU, or a lock held
during the busy hour — often on a database shared by every service. A five-minute comparison of shapes up
front is cheaper than any of those.

---

## What counts as "complex" (any one is enough)

- joins / eager loads across **3+ tables**, or any join onto a large / time-series table (events, logs,
  positions, transactions);
- `GROUP BY` / aggregates / window functions / `DISTINCT` over a large set;
- sub-queries, `EXISTS`/`ANY` over a collection, an `IN` list that is not small and bounded;
- recursive / hierarchical walks (org trees, parent chains);
- date-range scans, reports, exports, paging over a large table, or anything without a selective
  indexed predicate;
- raw SQL, bulk updates / deletes;
- a query on a hot path (per message, per batch, per request on a high-traffic endpoint).

## The brainstorm — what to present before writing code

Present it to the user in the plan (or in chat) and **wait for a go-ahead**:

1. **The question in one line** — what rows, for whom (tenant scope + soft-delete filter), how many
   expected (order of magnitude today and in a year).
2. **2–3 candidate shapes**, e.g. single projected query with joins vs. two queries + in-memory map vs.
   a pre-aggregated / cached source vs. a raw SQL / view.
3. **For each candidate**: round-trips, indexes it relies on (name them; say if one is missing), expected
   rows scanned vs. returned, memory pulled into the app, and lock/write impact if it writes.
4. **The generated SQL** of the favourite (the ORM's SQL dump / query logging) — and, when the table is
   large, the query plan (`EXPLAIN`, `EXPLAIN ANALYZE`) against a realistic DB (never run `ANALYZE` of a
   write on production).
5. **Recommendation + why**, and whether a new index / migration is needed (if so, it goes through the
   project's migration review).

Do not start implementing the complex query until the user has confirmed the shape. If the chosen shape
changes mid-implementation, re-confirm — don't swap silently.

---

## ❌ Don't — first shape that compiled

```text
// "Alerts per vehicle for the last 30 days" — written straight away
vehicles = query("SELECT * FROM vehicles WHERE company_id = ?", companyId)
for v in vehicles:
    v.alertCount = query("SELECT COUNT(*) FROM alerts WHERE vehicle_id = ? AND created_at >= ?", v.id, from)  // ← N+1 over a large table
```

## ✅ Do — compare, confirm, then one set-based query

> **Option A** — one `GROUP BY vehicle_id` on `alerts` filtered by the company's vehicle ids + date range;
> 1 round-trip, uses the `(vehicle_id, created_at)` index, returns ≤ N rows. **Option B** — read the daily
> pre-aggregate if one exists; cheaper but stale up to 1 day. **Recommend A** (needs to be live).
> → *user confirms A* → implement:

```sql
-- one query, server-side aggregate
SELECT vehicle_id, COUNT(*) AS alert_count
FROM alerts
WHERE vehicle_id IN (:vehicleIds) AND created_at >= :from
GROUP BY vehicle_id;
```

---

## Exceptions

- **Simple query** (none of the triggers above): write it directly — still no N+1.
- **The user already specified the query shape** in the ticket or chat: confirm you read it the same way in
  one line, then implement — no need to re-brainstorm alternatives.
- **Re-using an existing, proven query** unchanged (calling an existing service function): no brainstorm,
  but check it is not being called once per item.
