# Architecture & widget hierarchy (Flutter)

## Feature-first `lib/` layout

Business logic lives in `lib/features/<feature>/`, never in `lib/app/` (routing/bootstrap) or scattered
across top-level folders. This is the Flutter analogue of `_modules/` in the Next.js/RN rules: the goal
is the same — a thin entry layer, and everything that matters grouped by feature, not by technical type.

```
lib/
├── app/                        # routing ONLY — thin
│   ├── app.dart                # MaterialApp.router + theme + localization wiring
│   └── router.dart             # go_router config — route list only, no business logic
├── core/                       # cross-feature primitives
│   ├── widgets/                # Basic + Base components (see hierarchy below)
│   ├── network/                # Dio client + interceptors (03-networking-and-models.md)
│   ├── storage/                # shared_preferences wrapper, persistence mixin (02-state-and-persistence.md)
│   └── theme/                  # design tokens — ONE place, never hardcoded hex in widgets
└── features/
    └── mail_list/
        ├── data/                # DTOs (freezed), repositories, Dio-backed data sources
        ├── domain/              # entities, repository interfaces (pure Dart, no Flutter imports)
        └── presentation/
            ├── providers/       # Riverpod providers/notifiers for this feature
            ├── screens/         # MailListScreen, MailDetailScreen
            └── widgets/         # feature-local widgets (MailListTile, etc.)
```

**Why split `data`/`domain`/`presentation` per feature, not by technical layer at the top level:** a
top-level `lib/repositories/`, `lib/screens/`, `lib/models/` split scales badly past a handful of
features — every change touches three distant folders. Feature-first keeps a change localized; `core/`
is strictly for what two or more features actually share, same rule as `common/` in the JS house rules.

**Routing files stay thin.** `router.dart` lists routes and which Screen each path builds — it does not
construct data, call providers, or branch on state:

```dart
// ✅ app/router.dart — thin
GoRoute(
  path: '/mail/:id',
  builder: (context, state) => MailDetailScreen(id: state.pathParameters['id']!),
),

// ❌ business logic leaking into the router
GoRoute(
  path: '/mail/:id',
  builder: (context, state) {
    final mail = ref.read(mailRepositoryProvider).fetchById(state.pathParameters['id']!); // NO
    return MailDetailScreen(mail: mail);
  },
),
```

## Component hierarchy — put widgets in the right layer

Same five-layer idea as the JS house rules, renamed for Flutter:

```
Basic     → AppGap, AppDivider, AppText          (structural, no business logic, thin wrapper over Text/SizedBox)
Base      → AppButton, AppTextField, AppCard      (in-house primitives; Theme-driven, no hardcoded style)
Common    → SearchBar, ConfirmDialog              (used across 3+ features, lives in core/widgets/)
Feature   → MailListTile, SenderAvatar            (one feature, lives in features/<feature>/presentation/widgets/)
Screen    → MailListScreen, MailDetailScreen      (route-level; lives in features/<feature>/presentation/screens/)
```

- Feature widgets **never** go in `core/widgets/` — that promotion only happens once a second feature
  genuinely needs the same widget, same rule as "Domain components never go in `common/`" in the JS rules.
- **Never style a raw `Container`/`Text`/`TextField` ad hoc in a Screen or Feature widget.** Build or
  reuse a `Base*` primitive. `Base*` is the only layer allowed to reach into `Theme.of(context)` directly
  or hand-tune padding/radius numbers — everything above it consumes the primitive's own typed props.
- Create widgets liberally, even for one use, if it clarifies what a build method is doing — a 150-line
  `build()` with five inline `Column`s nested three deep is exactly the smell this hierarchy exists to
  prevent.

## Navigation — `go_router` only, never `Navigator.push` with a raw route

```dart
// ✅ destinations the user can reach via a URL / deep link / back stack entry
context.go('/mail/$id');

// ✅ a transient stack you genuinely expect to pop (e.g. a confirmation flow)
context.push('/mail/$id/forward');

// ❌ never hand-build a MaterialPageRoute for an in-app destination
Navigator.push(context, MaterialPageRoute(builder: (_) => MailDetailScreen(id: id))); // NO
```

**Why:** `go_router` owns the URL, deep-link restoration, and the back button on every platform
(including web/desktop) consistently. A hand-built `MaterialPageRoute` bypasses all of that — the
address bar on web goes stale, and a deep link into that screen has no route to restore. Use
`context.go()` for anything that is a destination in its own right (list → detail, tab switch); reserve
`context.push()` for a short-lived step the user expects "back" to unwind (a wizard step, a confirmation
sheet-as-a-route).

## Function minimalism (same YAGNI as the JS rules)

Don't pre-extract a named method or a `useCallback`-equivalent wrapper for a one-line callback. Inline
anonymous closures in `onPressed`/`onTap`, and only pull a method out once it is reused or exceeds a
few lines:

```dart
// ✅ inline, no premature extraction
AppButton(onPressed: () => ref.read(mailListProvider.notifier).archive(mail.id), label: 'Archive'),
```

**Loading / empty / error are properties of the widget tree, not early returns that unmount whole
subtrees.** Express them the same way the JS rules do — a wrapper widget that renders the section header
even when the body is empty, not `if (isLoading) return const SizedBox()` guarding the entire screen.
See `05-hard-rules-checklist.md` → "Empty states — show, don't hide" for the Flutter equivalent of
`BaseEmptyFallBack`.
