---
name: flutter-coding
description: House conventions for Flutter mobile/desktop work — Riverpod state management with shared_preferences persistence synced via Notifier.listenSelf (redux-persist style), go_router navigation, Dio networking, Freezed/json_serializable models, reactive_forms validation, easy_localization i18n, very_good_analysis lint, mocktail testing. Applies a feature-first lib/ architecture, a five-layer widget hierarchy (Basic/Base/Common/Feature/Screen), function minimalism, and contract-first (never-cast) API parsing — the Dart-native counterpart to the fe-coding skill's _modules/_modules architecture for the JS stacks. Use whenever creating or editing a screen, widget, provider/notifier, repository, router route, or model in a Flutter project.
---

# Flutter Coding

One entry point for Flutter work, the Dart-native sibling of `fe-coding` (which covers Next.js and React
Native). Flutter shares no runtime with those stacks, so this skill is self-contained rather than
layering on `ai/shared-fe/`.

**Rules root** — where `ai/flutter/` is read from: `<project>/.claude/tlm-plugin/` if that directory
exists (this project's own committed, live copy — installed by `project-setup`), else
`${CLAUDE_PLUGIN_ROOT}`. When they differ, the project's copy wins.

---

## STEP 0 — Figma link present? Gate before any UI code (HARD STOP)

If the request contains a **figma.com link**, this is a design-implementation task. Before writing a
single widget:

1. **Verify the Figma MCP actually works this session** — use ToolSearch for `mcp__*[Ff]igma*`, then
   fetch the linked file. A session that cached a failed connection usually just needs the server driven
   directly over stdio, not a "not configured" conclusion — see `figma-to-code`'s PHASE 0 for the
   check ladder (token validity → file access → server start).
2. **If a check genuinely fails — STOP.** Report what failed and what unblocks it. Do not scaffold
   "something close" from the frame name or a screenshot; a guessed screen looks finished, so nobody
   re-checks it, and every wrong spacing/color/hierarchy ships as if reviewed.
3. Non-UI work in the same request that doesn't depend on the design (a provider, a repository method,
   a bug fix elsewhere) proceeds normally — say clearly which part is blocked.

---

## STEP 1 — Package stance (read once, don't re-litigate)

This project's actual choices live in `.claude/codebase-map.md`. If that file doesn't yet record a
`flutter:` block, the **defaults** (and why) are in `ai/flutter/00-package-decisions.md`:

| Concern | Default |
|---|---|
| State management | `riverpod` (`@riverpod` codegen) |
| Persistence | `shared_preferences`, synced via `Notifier.listenSelf` (redux-persist style) |
| Routing | `go_router` |
| Networking | `dio` |
| Models/JSON | `freezed` + `json_serializable` |
| Forms | `reactive_forms` |
| i18n | `easy_localization` |
| Lint | `very_good_analysis` |
| Testing | `mocktail` + Riverpod `ProviderContainer` overrides |

**A project may deviate** (Bloc for an audit-heavy enterprise app, Drift once offline search is needed) —
when it does, that choice is recorded in its own `.claude/codebase-map.md` and this skill follows it,
not the default table above. Don't silently re-introduce the default against a project's stated choice.

On the first substantive task in a repo, persist what you found to `.claude/codebase-map.md`:

```md
<!-- tlm:codebase-map v1 -->
- stack: flutter
- state management: riverpod
- persistence: shared_preferences (Notifier.listenSelf) — no SQL DB
- routing: go_router
- networking: dio
- notable: avoid Hive/Isar (stalled as of 2026); avoid GetX for anything long-lived
```

**Honor the project's own rules** — `CLAUDE.md`, `analysis_options.yaml`, an `openspec/` spec — the
same way `fe-coding` defers to a project's documented conventions. Surface a conflict rather than
silently overriding it.

---

## STEP 1.5 — Cross-repo context (when the work touches another repo of the system)

Same principle as `fe-coding`: **never invent a contract that lives in another repo.** A mail-sync app
almost always has a backend or a third-party API (Gmail, IMAP) that owns the real shape of a message,
a label, a sync-state enum. Read `.claude/ecosystem-map.md` first (written by `project-setup`), then open
the actual contract — the backend DTO, the API's published schema — before writing a Freezed model for
it. A model shaped by guesswork passes `flutter analyze` and fails at runtime the first time a field is
actually missing or renamed.

If the repo you need isn't registered, say so and offer to add it — don't guess and don't silently
proceed. See `fe-coding`'s STEP 1.5 for the exact `ecosystem.mjs` commands; they're stack-agnostic.

---

## STEP 2 — Shared base (applies to every screen/feature)

### 1. Feature-first `lib/` architecture

```
lib/
├── app/            # routing ONLY — thin (app.dart, router.dart)
├── core/           # cross-feature: widgets/, network/, storage/, theme/
└── features/<feature>/
    ├── data/           # DTOs (freezed), repositories, Dio data sources
    ├── domain/         # entities, repository interfaces — pure Dart
    └── presentation/
        ├── providers/  # Riverpod providers/notifiers
        ├── screens/
        └── widgets/
```

Full depth, code examples, and the "why feature-first not layer-first" rationale:
`ai/flutter/01-architecture-and-widgets.md`.

### 2. Widget hierarchy — five layers

```
Basic     → AppGap, AppDivider, AppText       (structural, no business logic)
Base      → AppButton, AppTextField, AppCard  (in-house primitives, Theme-driven)
Common    → SearchBar, ConfirmDialog          (3+ features, core/widgets/)
Feature   → MailListTile, SenderAvatar        (one feature)
Screen    → MailListScreen, MailDetailScreen  (route-level)
```

Never style a raw `Container`/`TextField` ad hoc outside a `Base*` primitive — see
`ai/flutter/01-architecture-and-widgets.md` for the full rule and the "create liberally" guidance.

### 3. Navigation — `go_router` only (CRITICAL)

```dart
// ✅ destinations
context.go('/mail/$id');
// ✅ a transient stack you expect to pop
context.push('/mail/$id/forward');
// ❌ never
Navigator.push(context, MaterialPageRoute(builder: (_) => MailDetailScreen(id: id)));
```

`go_router` owns the URL, deep-link restoration, and back-button behavior consistently across
mobile/web/desktop — a hand-built route bypasses all of it. Full rule: `ai/flutter/01-architecture-and-widgets.md`.

### 4. Function minimalism (YAGNI)

Inline anonymous closures for one-line callbacks; don't pre-extract a named method or memoize
something cheap. Loading/empty/error are properties the widget tree expresses via a wrapper (keeps the
section header rendered), never an early `return` that unmounts the whole subtree. See
`ai/flutter/05-hard-rules-checklist.md` §5 for the empty-state pattern.

### 5. Styling

- Theme tokens live in ONE place (`core/theme/`) — never a hardcoded `Color(0xFF...)` in a Feature or
  Screen widget. A new color is a token change.
- `Base*` is the only layer allowed to reach `Theme.of(context)` directly or hand-tune spacing numbers.

### 6. Naming

| Kind | Convention | Example |
|---|---|---|
| Widgets | PascalCase + suffix | `MailListScreen`, `MailListTile` |
| Notifiers | PascalCase + `Notifier` | `MailListNotifier` |
| Providers | camelCase, generated by `@riverpod` | `mailListProvider` |
| Repositories | PascalCase + `Repository` | `MailRepository` |
| Models | PascalCase, no prefix | `Mail`, `SyncResult` |

### 7. Dart type safety

- Never `dynamic` where a concrete type or generic is available.
- Never a blanket `// ignore_for_file` without a comment explaining why — same discipline as `@ts-ignore`
  in the JS rules.
- Prefer sealed classes / Freezed unions over a nullable-field struct standing in for a state machine.

### 8. Validation — `reactive_forms`, one `FormGroup` is the source of truth

Default to `ReactiveTextField`/`ReactiveDropdownField` bound to a `FormGroup` built once per screen's
provider. Reach for a custom `ReactiveFormField<T>` only for genuinely custom fields. Full pattern and
localized-validation-message rule: `ai/flutter/04-forms-and-i18n.md`.

### 9. State & persistence — Riverpod, redux-persist-style sync for anything durable

`@riverpod`-codegen notifiers for all app state. Anything that must survive a restart (settings, auth
tokens, filter rules) persists automatically via `Notifier.listenSelf` writing to `shared_preferences`
on every state change — not a manually-called `save()` that's easy to forget on a new method six months
later. Full pattern, debouncing hot state, and the Freezed-model tie-in: `ai/flutter/02-state-and-persistence.md`.

### 10. Networking & models — Dio + Freezed, never cast a response

One shared `Dio` instance per base URL with interceptors doing auth refresh/retry/logging — never
`Dio()` ad hoc per call site. Responses parsed via generated `fromJson`, never `as Map`/`as String` at
the call site. Models mirror the backend field-for-field. Full pattern:
`ai/flutter/03-networking-and-models.md`.

---

## Before finishing any screen or feature

Run the checklist in `ai/flutter/05-hard-rules-checklist.md` — routing thin, widget hierarchy respected,
state via Riverpod with persistence wired through `listenSelf`, responses parsed not cast, all three
`AsyncValue` states handled, every string through `.tr()`, `flutter analyze` clean, new logic covered by
a `mocktail` test.

Plus: **every cross-repo contract you used came from a file you actually opened**, not a shape that
looked right (STEP 1.5). If you had to assume one, say so explicitly in your summary.

If the user corrects your output — "do it this way instead, because…" — that feedback may be a rule
worth keeping. See the `rule-capture` skill.
