# App Router — Hard Rules

The enforceable rules for Next.js App Router (`src/app/`, Next.js 13+). The `fe-coding` skill inlines
the top few; this file is the full set. Deep detail: `01-architecture`, `02-routing-structure`,
`03-server-actions`, `04-data-fetching` in this folder.

**Applies on top of** `ai/shared-fe/` — `_modules/` architecture, component hierarchy, Link-only
navigation, function minimalism, no `as any`, i18n. Everything here is App-Router-specific.

> **App Router is the exception, not the default.** Reach for it when you genuinely need it — chiefly
> **public, SEO-facing "publish" pages** (marketing, landing, blog, docs) wanting SSR/SSG/ISR, streaming,
> or Server Components/Actions. Management/admin/internal apps default to **Page Router**. Don't adopt
> App Router for modernness alone. See `ai/README.md` → router policy.

## When this applies

The project (or a slice of it) is a **public/publish surface** needing SEO/SSR, and has `src/app/` with
`page.tsx`/`layout.tsx`, async Server Components, imports from `next/navigation`, or `'use server'`.

An internal management app belongs in the Page Router rules instead. Note that `app/api/**/route.ts`
**without** `app/page.tsx` is Page Router **Mode B**, not an App Router app — see
`../page-router/05-fullstack-nextjs-api-prisma.md`.

## 1. Routing layer stays thin

`app/` holds only routing files; business logic lives in `_modules/pages/`.

```tsx
// src/app/products/page.tsx  — thin
import ProductListScreen from '@/_modules/pages/Product/ProductListScreen';
export default function Page() {
  return <ProductListScreen />;
}
```

Special files: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`.
Route groups `(name)/`, dynamic `[id]/`, catch-all `[...slug]/`, parallel `@slot/`, intercepting `(.)`.

## 2. Server vs Client Components

- **Server Component by default** (no directive): can be `async`, fetch data, read secrets; no hooks or state.
- **Client Component** (`'use client'` at top): needs hooks, state, effects, event handlers, browser APIs.
- Keep `'use client'` **at the leaves**. Fetch in Server Components and pass data down. A Client
  Component may render Server Components only through `children`.
- **Never call `Date.now()` / `new Date()` / `Math.random()` during render** (Server or Client). Server
  and client produce different values → hydration mismatch and broken prerendering. Compute timestamps
  in the data layer, an event handler, or an effect.

```tsx
// Server Component — fetch on the server
export default async function ProductListScreen() {
  const products = await getProducts();        // server-side, from _modules/server or _api
  return <ProductGrid products={products} />;  // ProductGrid can be 'use client' for interactivity
}
```

## 3. Navigation

`Link` for navigation (shared rule). Imperative cases use `next/navigation`:

```tsx
'use client';
import { useRouter, usePathname, useParams, useSearchParams } from 'next/navigation';
// router.push / router.replace only for post-action redirects — NOT for user-clickable nav (use Link).
```

Read params with `useParams()` / `useSearchParams()` (client) or the `params` / `searchParams` props
(server) — **never** `next/router`.

## 4. Server Actions (`'use server'`)

Prefer Server Actions over route handlers for mutations. Keep them in `_modules/server/`.

```tsx
// _modules/server/actions/product.ts
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createProduct(formData: FormData) {
  const parsed = ProductSchema.parse(Object.fromEntries(formData)); // Zod
  await db.product.create({ data: parsed });
  revalidatePath('/products');        // or revalidateTag('products')
}
```

- Validate inputs with Zod **inside** the action.
- Progressive enhancement: bind to `<form action={createProduct}>`; use `useFormStatus` /
  `useActionState` in Client Components for pending and optimistic UI.
- **Auth-protect every action** — check the session at the top. An exported Server Action is a public
  HTTP endpoint. See `03-server-actions.md`.

## 5. Data fetching & caching

- `fetch()` in Server Components is cached by default; opt out with `{ cache: 'no-store' }` or
  `{ next: { revalidate: N, tags: [...] } }`.
- Hybrid: fetch initial data in a Server Component, hydrate a Client Component's TanStack Query for
  interactivity. See `04-data-fetching.md`.
- Stream with `loading.tsx` / `<Suspense>`; handle errors with `error.tsx`. See §9 for the shell-vs-`Suspense`
  split — a whole-page `loading.tsx` is usually the wrong tool.

## 6. Route handlers (`route.ts`) — only for real HTTP endpoints

```ts
// src/app/api/products/route.ts
export async function GET() {
  return Response.json({ data: await getProducts() });
}
```

Prefer Server Actions for form mutations. Use route handlers for webhooks, third-party callbacks, or a
public JSON API.

## 7. Layouts & global navigation

Shared headers/nav belong in `layout.tsx`, not per-page. A `'use client'` `GlobalNav` reads
`usePathname()` for context-aware menus and can pull a dynamic API-driven menu — all navigation via
`Link`. Full pattern: `02-routing-structure.md` → "Global Navigation".

## 8. States are part of the screen (done-criteria)

A screen isn't done with only the happy path. Before calling any screen/route finished:

- New route segment → ships `error.tsx` always. Ship `loading.tsx` only when the segment's shell
  genuinely cannot be static (§9) — the default is a synchronous shell with per-region `<Suspense>`,
  not a segment-level loading fallback.
- **Do NOT add a root `app/loading.tsx` when `app/page.tsx` only redirects.** It wraps the entire app
  in a Suspense boundary, and if nothing resolves it every route paints the skeleton forever and no
  page is reachable — the DOM shows an unresolved `<template id="B:0">` under the fallback. The
  segment has no content of its own to stream, so the file buys nothing and costs the whole app. A
  root `error.tsx` is still worth having: without one, a redirecting root has no error boundary at all.
- Empty data → the project's shared empty-state component, with the section header still rendered
  (`ai/shared-fe/03` → "Empty States") — never an ad-hoc `<div>No data</div>`
- Failure surface → the shared error-banner/toast component, never a one-off treatment
- Forms/actions → pending UI via `useFormStatus` / `useActionState`: disabled submit, optimistic update
  or skeleton refresh

## 9. Stream data, not the page — no whole-page loading skeletons (MUST)

- **Render the static shell synchronously and immediately.** Page/layout components return their
  header, nav, tabs and other static chrome without `await`ing anything first. Awaiting dynamic data
  at the top of a page/layout opts the **whole route** into dynamic rendering and blocks first paint —
  the user waits on the slowest read to see chrome that never depended on it.
- **Wrap only the region that reads dynamic data** — `searchParams`, `cookies()`, an uncached DB/API
  read, a record by id — in its own `<Suspense fallback={<DataShapedSkeleton />}>`. Shape the skeleton
  like the data it stands in for (a table skeleton for a table, cards for cards, a detail skeleton for
  a detail pane). Never a full-page skeleton — it throws away the static shell you already have.
- **Move the slow read into a co-located async child** (e.g. `orders-table.tsx`) that the synchronous
  page renders inside the `Suspense` boundary, passing the `searchParams`/`params` **promise** down —
  the child `await`s it, not the page.
- A synchronous shell means the route segment never suspends at the top level, so a whole-page
  `loading.tsx` is not merely unneeded, it is **harmful**: it hides the static chrome on every
  navigation into the segment. Remove it. Keep `loading.tsx` only where the shell genuinely cannot be
  static (e.g. a public page rendered entirely from uncached settings) — same failure mode as the root
  `app/loading.tsx` warning in §8, one level down.
- **With Cache Components / PPR** (`cacheComponents: true` in `next.config`): data read via `use cache`
  is part of the static shell (prerenderable) and is fine to `await` directly in the shell.
  `searchParams`, `cookies()`, and any uncached read stay dynamic and MUST sit behind `<Suspense>`.
- **For a searchParams-driven list**, key the inner `<Suspense>` (or its child) on the client's
  `useSearchParams()` value (e.g. `key={searchParams.toString()}`) so switching a tab/page/filter shows
  the skeleton instantly instead of leaving stale rows on screen while the new read resolves.

```tsx
// ✅ shell renders immediately; only the table suspends
// src/app/orders/page.tsx
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Col>
      <OrdersHeader />                              {/* static chrome, no await */}
      <OrdersTabs />
      <Suspense fallback={<OrdersTableSkeleton />}>
        <OrdersTable searchParams={searchParams} /> {/* async child does the read */}
      </Suspense>
    </Col>
  );
}
```

```tsx
// ❌ awaiting at the top blocks the whole shell behind one skeleton
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const orders = await getOrders(status);   // whole route now dynamic
  return (
    <Col>
      <OrdersHeader />
      <OrdersTabs />
      <OrdersTableView orders={orders} />
    </Col>
  );                                          // loading.tsx paints a full-page skeleton meanwhile
}
```

Cite: Next.js docs — "Loading UI and Streaming", "Partial Prerendering".

### 9.1 Skeleton the data, not the chrome (tables)

A table's column header and pager are chrome, not data — they don't depend on the slow read, so don't
let them sit inside the `<Suspense>` that wraps the rows.

- **Keep `<thead>` and the pager in the static shell.** Only the `<tbody>` suspends. A client
  sort-header component reads sort/direction off the URL itself (`useSearchParams`), so `<thead>` needs
  no server props and can render synchronously — sorting is chrome-side state, not a data dependency.
- **Give the pager its own `<Suspense>`**, reading the current page from the URL, so it stays mounted
  and simply re-renders instead of flashing a fallback while rows stream in.
- **Share one query promise between the rows and the pager.** Create the promise (uncalled/`await`-free)
  once in the page shell and pass it to both the streamed body (for rows) and the pager's `<Suspense>`
  boundary (for total count/page count) — two consumers of the same promise, one query.

```tsx
// ✅ header + pager are static; only <tbody> suspends
// src/app/orders/page.tsx
export default function Page({ searchParams }: { searchParams: Promise<{ page?: string; sort?: string }> }) {
  const ordersPromise = getOrders(searchParams);  // created, not awaited — one query, two consumers

  return (
    <Col>
      <table>
        <SortableHead />                            {/* client component, reads sort from the URL */}
        <Suspense fallback={<OrdersTableRowsSkeleton />}>
          <OrdersTableBody ordersPromise={ordersPromise} />
        </Suspense>
      </table>
      <Suspense fallback={<PagerSkeleton />}>
        <OrdersPager ordersPromise={ordersPromise} />
      </Suspense>
    </Col>
  );
}
```

```tsx
// ❌ skeletoning the whole table throws away static chrome you already have
<Suspense fallback={<WholeTableSkeleton />}>
  <OrdersTable searchParams={searchParams} />       {/* header + pager re-mount on every load */}
</Suspense>
```

### 9.2 Tabs must not round-trip

URL-synced tabs whose panels are **all already mounted** (no data dependency per tab, just visibility)
switch client-side only. Use `window.history.replaceState` + local state to update the URL, **not**
`router.replace`/`router.push` — the router call re-enters the Next.js Router and triggers a server
re-render / refetch of the segment, which makes a same-page tab switch feel like a full navigation.

Next.js docs — "Native History API" (`Linking and Navigating`): `pushState`/`replaceState` calls
integrate into the Next.js Router, so `usePathname`/`useSearchParams` stay in sync without going through
`router.push`/`router.replace`.

```tsx
'use client';
// ✅ URL reflects the active tab, no server round-trip
function switchTab(tab: string) {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab);
  window.history.replaceState(null, '', `?${params.toString()}`);
  setActiveTab(tab); // local state drives which mounted panel is visible
}
```

```tsx
// ❌ re-enters the router — triggers a server re-render for a client-only visibility change
function switchTab(tab: string) {
  router.replace(`?tab=${tab}`); // feels slow: refetches/rerenders the segment
}
```

Only reach for `router.replace`/`router.push` when the tab switch has a genuine, uncached data
dependency the current page hasn't fetched yet (e.g. server-rendered panels loaded on demand) — not for
switching between already-mounted panels.

### 9.3 No unfriendly native `<select>`

Prefer the project's searchable select component over a raw browser `<select>` for user-facing choices
— a native `<select>` doesn't filter/search and renders inconsistently across platforms. Wire it into
`react-hook-form` via `Controller`, not `register` (a custom component isn't a native form field):

```tsx
<Controller
  name="status"
  control={control}
  render={({ field }) => (
    <SearchableSelect options={statusOptions} value={field.value} onChange={field.onChange} />
  )}
/>
```

## Checklist

- [ ] `app/` files are thin; logic in `_modules/pages/`
- [ ] `'use client'` only where hooks/interactivity are needed, pushed to the leaves
- [ ] No `Date.now()` / `new Date()` / `Math.random()` during render (hydration)
- [ ] States shipped: `error.tsx`, shared empty state, pending UI on forms
- [ ] Static shell renders synchronously; dynamic reads live behind a data-shaped `<Suspense>`, not a
      whole-page `loading.tsx` (§9)
- [ ] No root `app/loading.tsx` over a redirect-only `app/page.tsx` (deadlocks every route)
- [ ] Table `<thead>` + pager stay static; only `<tbody>` suspends, on a shared query promise (§9.1)
- [ ] URL-synced tabs over already-mounted panels use `window.history.replaceState`, not
      `router.replace`/`router.push` (§9.2)
- [ ] User-facing choice fields use the project's searchable select via `Controller`, not a raw
      `<select>` (§9.3)
- [ ] Params via `next/navigation` or props, never `next/router`
- [ ] Mutations via Zod-validated, auth-checked Server Actions + `revalidatePath` / `revalidateTag`
- [ ] Shared rules from `ai/shared-fe/` applied
