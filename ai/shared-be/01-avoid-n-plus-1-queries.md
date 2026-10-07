# Avoid N+1 Queries (Shared Backend)

> **Applies to**: any server that talks to a database — through an ORM, a query builder, or raw SQL, in
> any language. Cross-stack backend rule, the backend counterpart to `ai/shared-fe/`. Examples below are
> pseudocode; map `query(...)` onto your data layer.

**Rule:** never issue one query per item of a collection. Load the related data a collection needs in
**one** round-trip — via the data layer's include/join/projection, or a single batched `WHERE id IN (…)` —
not by re-querying inside a loop (or once per emitted item). Fall back to a per-item query **only** when
batching is genuinely impossible, and then bound and document it (see Exceptions).

**Why (the failure it prevents):** an N+1 is 1 query for the list + 1 more for each of its N items. It
looks fine with 5 rows in dev and melts the database at 5,000 in prod — latency and DB load grow linearly
with N, the connection pool starves, and the endpoint times out under exactly the load you shipped it
for. The worst variant re-queries data the request **already holds in memory**.

---

## ❌ Don't — a query per item

```text
// one extra round-trip per reminder that gets dispatched
for reminder in dueReminders:
    vehicle = query("SELECT plate, owner_email FROM vehicles WHERE id = ?", reminder.vehicleId)   // ← N+1
    send(reminder, vehicle)
```

## ✅ Do — one query that carries what you need

**1. Include/join the relation in the query that already loads the collection** (best — you own that query):

```sql
-- plate + owner arrive WITH the list — zero extra round-trips
SELECT r.id, r.vehicle_id, v.plate, u.email AS owner_email
FROM reminders r
JOIN vehicles v ON v.id = r.vehicle_id
JOIN users    u ON u.id = v.created_by
WHERE r.due_at <= :now;
```

**2. Batch by id when you can't touch the first query** — collect ids, one `IN` query, map in memory:

```text
ids    = unique(items.map(i => i.vehicleId))
plates = toMap(query("SELECT id, plate FROM vehicles WHERE id IN (?)", ids), key = id)   // one query, not N
for i in items: use(plates[i.vehicleId])
```

**3. If the data is already loaded, don't re-query it** — thread the in-memory value through (a DTO field,
a function parameter) instead of fetching it again in a downstream helper. Re-fetching what you already
have is an N+1 with no upside.

---

## Hierarchy / tree walks — one query per level, not per node

Walking a parent chain (ancestors) or a subtree (descendants) is the same trap in disguise: a query per
node — or worse, a full per-node walk repeated once per root — is an N+1 that scales with the tree size.

- ❌ **Per-root ancestor walk** — `for root in roots: hasSuspendedAncestor(root.parentId)`, each doing one
  query per level. 100 roots over a 5-level chain ≈ 500 sequential round-trips.
- ✅ **Frontier batching** — gather all ids at a level, query the whole level once, repeat:

```text
pending = startIds
while pending not empty:
    level = query("SELECT id, parent_id, is_suspended FROM companies WHERE id IN (?)", pending)  // one query per level
    record level into an in-memory map
    pending = parents of level not yet visited
// resolve each node against the in-memory map — no more DB access
```

Round-trips become `O(depth)`, independent of node/root count. A recursive CTE (`WITH RECURSIVE`) does the
same in one round-trip where the database supports it. Also **don't load the whole table** to serve a
request that only needs one user's subtree — query to the actual scope.

---

## Exceptions — "unless there is no other way"

A per-item call is acceptable only when batching is genuinely unavailable, and then you must **bound** and
**document** it:

- a third-party / cross-service call with **no batch endpoint** — cap concurrency, cache by key, and
  comment why it can't be batched;
- provider APIs that accept a selector — **chunk** (e.g. 100 ids/request), never 1/request, where allowed.

Any per-item query that survives review MUST carry a `N+1 unavoidable: <reason>` comment, so the next
reader knows it was a deliberate decision, not an oversight. When in doubt, measure: an N+1 hides until the
collection grows.
