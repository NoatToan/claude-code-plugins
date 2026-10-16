# Package decisions (Flutter, 2026)

Why each default was picked, so a future session doesn't re-litigate it from scratch. Sourced from a
2026 landscape pass (state management, routing, networking, local storage) done for a mail-cleaner POC.
Revisit this file, not your priors, when a package here looks stale — package maturity in the Flutter
ecosystem moves fast (Hive and Isar both went from "standard choice" to "stalled" within two years).

| Category | Default | Rejected alternatives | Why |
|---|---|---|---|
| **State management** | `riverpod` (3.x, codegen via `riverpod_generator`/`@riverpod`) | Bloc/Cubit, Provider, GetX | Only Flutter-Favorite state package as of 2026; compile-time safe, doubles as DI (no `get_it` needed), lowest boilerplate, strong async/offline primitives. Bloc remains the right call for an audit-heavy enterprise app with 3+ devs — swap deliberately, not by default. GetX: do not start new projects with it — migration cost only makes sense for an app already built on it. |
| **Routing** | `go_router` (+ `go_router_builder` for typed routes) | `auto_route` | Flutter-team-endorsed default since 2023; the only router most production apps use by 2026. `auto_route` is a legitimate codegen-heavy alternative if the team prefers it. |
| **Persistence** | `shared_preferences`, synced through a Riverpod `Notifier.listenSelf` (redux-persist-style auto persist + rehydrate) | Drift (SQL), Hive/Hive CE, Isar | **Hive and Isar are both stalled/unmaintained as of 2026 — do not start new projects on either.** Drift is the right call once the app needs structured offline search over email lists; for this POC, state-level persistence (settings, auth tokens, filter rules) via `shared_preferences` is enough. Revisit if email caching needs real queries. |
| **Networking** | `dio` | `http`, `chopper` | De facto standard — interceptors for OAuth/token refresh, retry, cancel tokens, logging. Needed for Gmail/IMAP-style auth flows where a bare `http` client would mean hand-rolling refresh logic. |
| **Models / JSON** | `freezed` + `json_serializable` | hand-written Dart 3 sealed classes | Standard combo for immutable DTOs mirroring backend/API responses field-for-field (same "never hand-roll the wire type" principle as the Next.js Zod rule) — `copyWith`, union types (`when`/`map`), and generated `fromJson`/`toJson` with no cast-and-pray. |
| **Forms / validation** | `reactive_forms` | `flutter_form_builder`, manual + `formz` | Model-based, schema-like validation — closest Flutter analogue to the Zod-first pattern: one `FormGroup` definition is the source of truth for both the UI binding and the validation rules. |
| **i18n** | `easy_localization` | official `flutter gen-l10n` + `intl` | `.tr()` extension calls mirror the i18next `t()` convention used in the Next.js/RN rules closely enough that the "never hardcode a display string" rule ports over unchanged. |
| **Lint** | `very_good_analysis` | `flutter_lints` (official default) | Stricter ruleset — closer to enforcing the house conventions below (widget layering, no raw primitives leaking through) than the loose `flutter create` default. |
| **Testing** | `mocktail` + Riverpod testing utils (`ProviderContainer` overrides) | `mockito` | No code generation needed for mocks; pairs cleanly with Riverpod's override-based testing model. |
| **DI** | Riverpod providers only | `get_it` + `injectable` | Riverpod already is a DI container — a second one is redundant. `get_it` is the right call only in a Bloc/Provider codebase that has no equivalent. |

## Recording a project's actual choice

Every project using this skill records which of these it actually adopted (they are defaults, not a
mandate) in its own `.claude/codebase-map.md`, the same way `tlm-fe-coding`/`fe-coding` records
`backend: bff → <repo>` for Next.js. Example:

```md
<!-- tlm:codebase-map v1 -->
- stack: flutter
- state management: riverpod
- persistence: shared_preferences (Notifier.listenSelf) — no SQL DB
- routing: go_router
- networking: dio
- models/JSON: freezed + json_serializable
- forms/validation: reactive_forms
- i18n: easy_localization
- lint: very_good_analysis
- testing: mocktail + riverpod testing utils
```
