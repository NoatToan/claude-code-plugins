# Flutter Knowledge Base

Platform-specific rules for building **Flutter** apps following the shared house philosophy. Flutter
shares no runtime with the JS stacks (`nextjs/`, `reactnative/`), so nothing here is inherited from
`ai/shared-fe/` automatically — every principle that genuinely carries over (thin routing layer, widget
hierarchy, function minimalism, visible empty states, contract-first models) is restated here in Dart
terms rather than cross-referenced, so this folder stands alone.

```
ai/flutter/
├── 00-package-decisions.md        # Why Riverpod, go_router, Dio, Freezed, reactive_forms — pick once, record it
├── 01-architecture-and-widgets.md # feature-first lib/ layout, widget hierarchy (Basic→Base→Common→Feature→Screen)
├── 02-state-and-persistence.md    # Riverpod + shared_preferences redux-persist-style sync (Notifier.listenSelf)
├── 03-networking-and-models.md    # Dio client/interceptors, Freezed + json_serializable, contract-first parsing
├── 04-forms-and-i18n.md           # reactive_forms validation, easy_localization
└── 05-hard-rules-checklist.md     # go_router navigation, lint (very_good_analysis), testing, done-criteria
```

## Package stance (2026)

Pinned in `00-package-decisions.md` — the short version: **Riverpod** (not Bloc/Provider/GetX),
**go_router** (not auto_route), **Dio** (not `http`), **Freezed + json_serializable** for models,
**reactive_forms** for validation, **easy_localization** for i18n, **very_good_analysis** for lint,
**mocktail** for testing. Persistence is **shared_preferences synced through Riverpod**
(`Notifier.listenSelf`, redux-persist-style) — not a SQL database (Drift) — because the decision was
made for a mail-client POC that doesn't need offline structured search yet. **Avoid Hive and Isar** —
both stalled/unmaintained as of 2026.

A project that needs a different pairing (e.g. Bloc for an audit-heavy enterprise app, or Drift once an
app needs real offline search) overrides this file for itself and says so in its own
`.claude/codebase-map.md` — these are the house defaults, not a hard requirement.

## What is different from the JS stacks

| Web/RN (`nextjs/`, `reactnative/`) | Flutter (`flutter/`) |
|---|---|
| `_modules/` folder, routing files import a Screen | `lib/features/<feature>/` (data/domain/presentation), `app/router.dart` thin |
| TypeScript + Zod | Dart + Freezed (sealed unions, `copyWith`, exhaustive `when`) |
| TanStack Query | Riverpod `AsyncNotifier` / `FutureProvider` |
| `localStorage` / `AsyncStorage` | `shared_preferences`, synced via `Notifier.listenSelf` |
| Next.js `<Link>` / Expo Router `router.navigate` | `go_router` — `context.go()` for destinations, `context.push()` only for a stack you expect to pop |
| React Hook Form + Zod | `reactive_forms` (`FormGroup` + validators) |
| i18next `t()` | `easy_localization` `.tr()` |
| ESLint | `very_good_analysis` |
