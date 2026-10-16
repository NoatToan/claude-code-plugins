# Forms & i18n (reactive_forms + easy_localization)

## Forms — one `FormGroup` is the source of truth

`reactive_forms` plays the role Zod + React Hook Form play in the Next.js rules: **one declarative
definition drives both the UI binding and the validation**, so there is nowhere for client-side rules to
drift from what the screen actually enforces.

```dart
final filterForm = FormGroup({
  'senderContains': FormControl<String>(validators: [Validators.maxLength(100)]),
  'olderThanDays': FormControl<int>(value: 30, validators: [Validators.min(1), Validators.max(365)]),
});

ReactiveTextField<String>(
  formControlName: 'senderContains',
  decoration: InputDecoration(labelText: 'filters.sender'.tr()),
),
```

- Build the `FormGroup` once per screen (in the Riverpod provider backing it, not rebuilt on every
  `build()`), the same "don't recompute what hasn't changed" principle as `useMemo` reserved for
  genuinely expensive work in the JS rules.
- **Validation messages are localized, never hardcoded English strings** baked into a `Validators.X`
  call — map validator keys to `easy_localization` keys in one place (a `ValidationMessages` table), not
  per-field inline strings.
- A field that needs heavy custom behavior (a composed date-range picker, a chip-based multi-select)
  gets a custom `ReactiveFormField<T>` wrapper — reach for this the same way the JS rules reserve
  `Controller`/`useController` for fields `register()` can't express, not as the default for every field.

## i18n — `easy_localization`, never a hardcoded display string

```dart
Text('mail.archived_success'.tr()),
Text('mail.unread_count'.tr(args: [count.toString()])),
```

**Every user-visible string goes through `.tr()`.** This includes button labels, `SnackBar` text, dialog
titles, and validation messages — not just screen body copy. The failure mode is identical to the
Next.js rule: a string that "will be translated later" ships to production and stays there, because
nothing marks it as untranslated once the feature looks done.

**Pluralization and interpolation go through the package's own mechanism** (`.plural()`, `args`/`namedArgs`),
never hand-built string concatenation (`'$count unread'`) — concatenation breaks the moment a language's
word order differs from English's.

## Display values are null-safe, same discipline as the JS rules

A `Mail.subject` or `Mail.sender` from the API can be empty, and a raw `Text(mail.subject)` leaks that
as a blank line with no visual signal. Wrap single values through a small `safeText()` helper
(`(v) => v.isEmpty ? 'common.no_subject'.tr() : v`) rather than repeating the same ternary in every widget
that renders the field — the same reasoning as `safeString()`/`joinText()` in the Next.js rules: one
helper, used everywhere a value is actually rendered, not re-invented per call site.
