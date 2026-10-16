# Hard rules & done-criteria checklist (Flutter)

The enforceable rules for this stack, mirroring `ai/nextjs/*/06-hard-rules.md` and
`ai/reactnative/06-hard-rules.md`. Applies on top of `01`–`04` in this folder.

## 1. Navigation

- `go_router` only. `context.go()` for destinations, `context.push()` only for a stack you expect to
  pop (see `01-architecture-and-widgets.md`).
- Never a hand-built `MaterialPageRoute`/`Navigator.push` for an in-app route.
- Deep link every top-level destination — if a screen can be reached from inside the app, it must also
  be reachable by URL/deep link, or web/desktop back-navigation and link-sharing silently break for it.

## 2. State & persistence

- Riverpod `@riverpod` codegen, one provider per cohesive concern.
- Anything that must survive an app restart persists via `Notifier.listenSelf` → `shared_preferences`
  (see `02-state-and-persistence.md`) — never ad hoc `SharedPreferences.getInstance()` calls scattered
  through widgets.
- No `setState` in a `StatefulWidget` for anything that is actually app/business state — `setState` is
  reserved for pure, local, non-persisted UI state (an expand/collapse toggle, a scroll controller).

## 3. Networking & models

- All network I/O through the shared `Dio` instance + interceptors — no ad hoc `Dio()` per call site.
- Responses parsed via generated `fromJson`, never cast (`as Map`/`as String`) at the call site.
- Models mirror the backend field-for-field; unions (`SyncResult`, `MailFailure`) model every outcome
  exhaustively — no nullable-field soup standing in for a state machine.

## 4. Widgets & styling

- Five-layer hierarchy honored (Basic → Base → Common → Feature → Screen); no raw `Container`/`TextField`
  styled ad hoc outside a `Base*` primitive.
- Theme tokens in one place (`core/theme/`); never a hardcoded `Color(0xFF...)` in a Feature or Screen
  widget.
- Function minimalism: inline closures for one-line callbacks, no premature extraction.

## 5. Empty states — show, don't hide (MUST)

Same rule as the JS house rules: a section with no data keeps its header and renders a visible empty
state, never a bare `if (items.isEmpty) return const SizedBox()` that erases the whole section.

```dart
// ❌ whole section vanishes — untestable, looks identical to "still loading" or "broken"
if (mails.isEmpty) return const SizedBox.shrink();

// ✅ header always renders; a wrapper owns the empty case
Column(children: [
  const SectionHeader(),
  AppEmptyState(
    isEmpty: mails.isEmpty,
    title: 'mail.all_clear'.tr(),
    child: ListView.builder(itemCount: mails.length, itemBuilder: (_, i) => MailListTile(mails[i])),
  ),
]),
```

## 6. Loading & error states are part of the screen, not an afterthought

- Every `AsyncNotifier`-backed screen renders all three of `AsyncValue`'s states explicitly
  (`.when(data:, loading:, error:)`) — never just the happy path with a TODO for the rest.
- A failed mutation (archive, delete, send) surfaces via the project's shared error affordance
  (a `SnackBar`/toast helper), never a silently swallowed `catchError((_) {})`.

## 7. i18n, lint, testing

- Every user-visible string through `easy_localization`'s `.tr()` — see `04-forms-and-i18n.md`.
- `very_good_analysis` enabled in `analysis_options.yaml`; no blanket `// ignore_for_file` without a
  comment explaining why (same discipline as `@ts-ignore` in the JS rules).
- New business logic (a notifier's methods, a repository, a mapper) ships with a `mocktail`-based unit
  test using Riverpod's `ProviderContainer` overrides to fake the Dio/repository layer — not a real
  network call in a test.

## Before finishing any screen or feature

- [ ] Routing file stays thin; logic lives in `features/<feature>/presentation/`
- [ ] Widget hierarchy respected; no ad hoc raw-widget styling outside `Base*`
- [ ] State via Riverpod; persisted state wired through `listenSelf`, not a manual save-on-every-call
- [ ] Network responses parsed via Freezed/`json_serializable`, never cast
- [ ] All three `AsyncValue` states handled; empty state visible with header intact
- [ ] Every display string through `.tr()`
- [ ] `flutter analyze` clean under `very_good_analysis`
- [ ] New logic covered by a `mocktail` unit test
