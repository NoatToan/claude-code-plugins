# Sitemap — keep it in step with the public routes

Applies to any web app with public, indexable pages (Next.js `app/sitemap.ts`, a static
`sitemap.xml`, or generated per-section sitemaps).

## The rule

**A change that adds, removes, renames or changes the indexability of a public route updates the
sitemap in the same PR.** Nobody revisits the sitemap later; if it is not in the PR, it never happens.

- **New public route** → add it to the sitemap (or to the generator that lists that section), with
  a sensible `lastModified` and, where used, `changeFrequency` / `priority`.
- **Removed or renamed route** → drop or rename the entry; leave a redirect for the old URL.
- **Route becomes private or `noindex`** (signed-in screens, previews, tooling) → remove it from
  the sitemap **and** add it to `robots.txt` `Disallow`. A URL must never be in the sitemap and
  `noindex` at the same time.
- **Dynamic pages** (one URL per record) → generate the entries from the same data source the pages
  are built from, so the two cannot drift. Split into a sitemap index once it nears 50,000 URLs.
- **New sitemap file** (a section with its own sitemap) → list it in the sitemap index and in
  `robots.txt` (`Sitemap: https://…/sitemap-x.xml`).
- **Canonical domain** comes from one constant (e.g. `SITE_URL` from `NEXT_PUBLIC_SITE_URL`), never
  hard-coded per entry, so a domain move updates every URL.

## Search Console

The sitemap index is submitted to Google Search Console once; Google re-reads it on its own. Adding
URLs to a sitemap that is already submitted needs no resubmission. **Do** resubmit (Search Console →
Sitemaps, or the Search Console API `sitemaps.submit`) when a **new sitemap file** is added that the
index does not list, or when the canonical domain changes.

## Check before you push

- Open `/sitemap.xml` (and every child sitemap) from a local build and confirm the new route is
  there and the removed one is gone.
- Every URL in it returns 200, has a self-referencing canonical and is not `noindex`.
- A test that builds the sitemap and asserts it contains each public route keeps the rule enforced
  in CI.

**Why:** search engines find new pages through the sitemap. A missing entry delays indexing by
weeks, and a stale one sends crawlers to 404s and `noindex` pages, which wastes crawl budget and
lowers trust in the whole sitemap.
