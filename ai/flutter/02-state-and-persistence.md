# State management & persistence (Riverpod + shared_preferences)

## State management — Riverpod, codegen-first

Default to `@riverpod`-annotated `Notifier`/`AsyncNotifier` classes (via `riverpod_generator`), not
hand-written `StateNotifierProvider` boilerplate. One provider per cohesive piece of state; a provider
that mixes two unrelated concerns (auth + mail list) is the Riverpod equivalent of a God-file.

```dart
@riverpod
class MailListNotifier extends _$MailListNotifier {
  @override
  FutureOr<List<Mail>> build() => ref.watch(mailRepositoryProvider).fetchInbox();

  Future<void> archive(String id) async {
    final repo = ref.read(mailRepositoryProvider);
    await repo.archive(id);
    ref.invalidateSelf(); // refetch — same "invalidate related queries onSuccess" idea as TanStack Query
  }
}
```

## Persistence — redux-persist-style, via `Notifier.listenSelf`

**The ask this pattern answers:** some provider state (settings, the signed-in account, active filter
rules) must survive an app restart, the same way `redux-persist` rehydrates a Redux store. Flutter has
no single dominant package for this the way `hydrated_bloc` exists for Bloc — the idiomatic Riverpod 3.x
mechanism is `Notifier.listenSelf`, wired to `shared_preferences` directly. **Do not reach for Hive/Isar
to solve this** — see `00-package-decisions.md` for why both are off the table in 2026.

```dart
// core/storage/persisted_notifier.dart
abstract class PersistedNotifier<T> extends Notifier<T> {
  PersistedNotifier(this._prefsKey);
  final String _prefsKey;

  T fromJson(Map<String, dynamic> json);
  Map<String, dynamic> toJson(T state);

  @override
  T build() {
    final raw = ref.watch(sharedPreferencesProvider).getString(_prefsKey);
    final initial = raw == null ? initialState() : fromJson(jsonDecode(raw) as Map<String, dynamic>);

    // the redux-persist part: every state change after this point is written back automatically
    listenSelf((_, next) {
      ref.read(sharedPreferencesProvider).setString(_prefsKey, jsonEncode(toJson(next)));
    });

    return initial;
  }

  T initialState();
}

// features/settings/presentation/providers/settings_notifier.dart
@Riverpod(keepAlive: true)
class SettingsNotifier extends _$SettingsNotifier implements PersistedNotifier<SettingsState> {
  static const _key = 'settings_v1';

  @override
  SettingsState build() => _persisted(_key, SettingsState.fromJson, (s) => s.toJson(), SettingsState.initial());

  void toggleAutoClean(bool value) => state = state.copyWith(autoCleanEnabled: value);
}
```

**Why `listenSelf` and not a manual `save()` call after every mutation:** a manual call is an easy rule
to forget on the Nth new method added to a notifier six months later — the same silent-drift failure mode
documented for `t()` i18n strings and Zod-parsed responses elsewhere in these rules. `listenSelf` makes
persistence a property of the provider's construction, not of each call site: every state transition,
present and future, persists without the author of a new method having to remember.

**Debounce writes on hot state.** A notifier that changes rapidly (a search-as-you-type filter) should
debounce the `setString` call (e.g. 300ms) inside `listenSelf`, not write on every keystroke — unlike
Redux-persist's throttled store subscription, `shared_preferences` writes are synchronous I/O per call
and an un-debounced hot path will visibly jank.

**Rehydration is synchronous for `shared_preferences` (already-loaded) data.** Call
`SharedPreferences.getInstance()` once at app bootstrap (before `runApp`) and inject the resolved
instance via an overridden provider (`sharedPreferencesProvider.overrideWithValue(prefs)`), so `build()`
above can read it synchronously — never `await` inside a `Notifier.build()`.

```dart
// main.dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    child: const App(),
  ));
}
```

## Freezed models carry their own `toJson`/`fromJson` into this

Persisted state should itself be a `@freezed` class with `json_serializable`'s `fromJson`/`toJson` —
see `03-networking-and-models.md`. Don't hand-write the (de)serialization inside the notifier; the
notifier calls the model's generated codec, same separation of concerns as a Zod schema's `parse` being
called from a service function rather than re-implemented per call site.

## When this is NOT enough

If a feature needs to **query** persisted data (search mail by sender, filter by date range across
thousands of cached rows), `shared_preferences` key-value storage is the wrong tool — reach for Drift
(SQL) for that feature specifically rather than contorting key-value storage into a query engine. Record
the exception in the project's `.claude/codebase-map.md`.
