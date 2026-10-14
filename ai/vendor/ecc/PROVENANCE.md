# ai/vendor/ecc — a synced copy, not a fork

Everything here except this file, `ecc.manifest.json`, `ecc.lock.json` and `sync-ecc.mjs` is a byte-for-byte copy of
files from **ECC** (Everything Claude Code). It is **not** maintained here. Do not edit it: the next sync overwrites the
edit, and nobody will notice it went missing.

| | |
|---|---|
| Upstream | `https://github.com/affaan-m/ECC` |
| Licence | **MIT**, copyright Affaan Mustafa. The licence text is `./LICENSE` and must stay beside the copied files. |
| Pinned commit / version / date | `./ecc.lock.json` (written by the sync, so it is always correct) |
| What is copied | `./ecc.manifest.json` → `paths` |

## How the house rules use it

The house rules **point at** these files instead of re-writing them, so an ECC improvement reaches every rule the
moment the copy is refreshed:

- `ai/nestjs/README.md` — NestJS backends. Routes to `skills/nestjs-patterns` and the backend files below.
- `ai/shared-be/README.md` — any backend. Routes to the house rules `01`–`04` first, then to these files.
- `ai/shared-be/README.md` → "Business-logic work": the vendored `agents/*.md` are the fallback instructions when the
  ECC plugin (`ecc:<name>`) is not enabled, and the pinned text the house overrides are written against.

Each of those READMEs has a **House overrides** section. That is where a house decision that disagrees with ECC is
written down. **A house rule always wins over an ECC file.** If ECC changes in a way the house disagrees with, write
the override there, not here.

## Updating

```bash
node ai/vendor/ecc/sync-ecc.mjs --check   # what would change (exit 1 on drift); writes nothing
node ai/vendor/ecc/sync-ecc.mjs           # fetch ECC main, copy the manifest paths, rewrite ecc.lock.json
```

After a sync, read the diff with the two READMEs' **House overrides** next to it. If a new ECC passage conflicts with a
house rule, add the override. Then commit, and ship upstream with `rule-capture`'s `plugin-pr.mjs`.

To vendor another ECC file, add its path to `ecc.manifest.json` → `paths`, run the sync, then add a row for it in the
README that should route to it. A file nobody routes to will never be read.

## Relationship to the ECC plugin

A project can also install the ECC plugin itself (`claude plugin install ecc@ecc`). The plugin follows ECC `main` with
every marketplace update. This copy is pinned and reviewed. The house rules cite **this copy**, so a rule never changes
meaning without a commit.
