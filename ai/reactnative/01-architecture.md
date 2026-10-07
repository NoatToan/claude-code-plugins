# RN Architecture, Build & State

> Shared principles (portable `_modules/`, component hierarchy, function minimalism) live in
> `ai/shared-fe/`. This file covers the **RN/Expo-specific** setup.

## Tech Stack
- **React Native 0.79** with **Expo ~53** (SDK 50+ for built-in Expo Router)
- **React 19**, **TypeScript** preferred for all new code
- **TanStack Query 5** — data fetching, caching, global cache
- **Zod** + **React Hook Form** + `@hookform/resolvers` — validation & forms
- **React Context Provider** for global state (no Zustand)
- **Expo Router** — file-based navigation (built in; no extra install)
- **AsyncStorage** — persistent client state (replaces `localStorage`)
- Animations — **optional**; Moti / React Native Reanimated only when a screen genuinely needs them (not a default dependency — see `02-styling`)

## Dependency policy

> **Build our own shared/common components (`Base*`, `Col`, `Row`, `TextPrimary`); minimize dependence on
> external UI packages.** Reach for a library only when the feature genuinely needs native/platform
> plumbing we should not reinvent.

**Preferred libraries** — when a feature needs one of these areas, PREFER these exact packages.

The list is split by platform because the two do NOT share the same answers. Work out which project you
are in before picking: **Expo** if `package.json` has `expo` + `expo-router` and there is an `app/`
directory; **RN CLI** if there is no `expo` and navigation comes from `@react-navigation/*`.

### Rule for Expo projects: reach for `expo-*` FIRST

In an Expo project, prefer the Expo SDK package over a community equivalent — even when the community
one looks more capable. An Expo module is versioned with the SDK, upgraded by `expo install`, ships its
own config plugin so no manual native edits are needed, and is covered by EAS builds. A community native
module is none of those, and each one added is a prebuild/config-plugin surface someone has to maintain
at every SDK upgrade.

Only fall through to a community package when the Expo SDK genuinely has no equivalent — those are the
**Both** rows at the bottom.

### Expo projects

| Area | Package |
|------|---------|
| Navigation | `expo-router` |
| Splash screen | `expo-splash-screen` |
| Status bar | `expo-status-bar` |
| In-app browser (OAuth, policy links) | `expo-web-browser` |
| Image picking | `expo-image-picker` (`allowsEditing` gives the crop step) |
| Image resize / compress before upload | `expo-image-manipulator` |

### React Native CLI projects

| Area | Package |
|------|---------|
| Navigation | `@react-navigation/native-stack` + `react-native-screens` |
| Splash screen | `react-native-bootsplash` |
| Status bar | RN's built-in `StatusBar` — no package needed |
| In-app browser (OAuth, policy links) | `react-native-inappbrowser-reborn` |
| Image pick + crop | `react-native-image-crop-picker` (native crop UI) |
| Image resize / compress before upload | `@bam.tech/react-native-image-resizer` |

Never put an `expo-*` package in a bare RN CLI project — they need the Expo runtime.

### Both — the Expo SDK has no equivalent, so the same package serves either

| Area | Package |
|------|---------|
| Safe-area insets | `react-native-safe-area-context` |
| Persistent key-value storage | `@react-native-async-storage/async-storage` |
| SVG / vector graphics / icons | `react-native-svg` |
| OTP / verification code input | `react-native-otp-entry` |
| Bottom-sheet modal | `react-native-modalize` — read the caveat below |

**Storage is AsyncStorage first.** It is the default and only storage layer until a requirement actually
outgrows it — do not add MMKV, SQLite/`expo-sqlite`, WatermelonDB or Realm speculatively. Outgrowing it
looks like thousands of rows, relational queries, offline sync or full-text search; auth tokens and user
preferences do not.

### Notes on the media / browser / modal entries

- **All of these are native modules.** On Expo they need a **development build** — none work in Expo Go.
  On RN CLI they need `pod install` plus a recompile, never just a Metro restart.
- **`@bam.tech/react-native-image-resizer`** is the maintained fork of the abandoned
  `react-native-image-resizer` — use the `@bam.tech/` scope, never the unscoped name. Always resize
  before upload on either platform; a modern phone camera produces 4–12 MB images that do not belong on
  the wire.
- **`react-native-image-crop-picker`** is the CLI answer because it ships a real native cropping UI. On
  Expo, `expo-image-picker` + `expo-image-manipulator` covers the same ground without a custom native
  module — which is why the Expo row does not name it.
- **`react-native-modalize` caveat (verified 2026-09-12):** the last npm release is `2.1.1`, published
  **2022-08-10**, and it peers on `react-native-gesture-handler`. That predates the New Architecture
  becoming the default, so on a Fabric-only project (RN 0.76+ with `newArchEnabled=true`) verify it
  actually renders before committing to it. If it does not, `@gorhom/bottom-sheet` is the maintained
  equivalent — it needs `react-native-gesture-handler` **and** `react-native-reanimated`. Either way a
  bottom sheet pulls in gesture-handler, which `native-stack` does NOT otherwise require.

Animation libraries (Moti / Reanimated) are **not** on the preferred list — treat them as optional add-ons,
consistent with minimizing external deps. **Exception:** some required native modules force
`react-native-worklets` / `react-native-reanimated` in as a hard peer — `react-native-executorch` requires
worklets, and `react-native-keyboard-controller` requires Reanimated. When a required dependency pulls
them in, that is not a violation of this policy.

## Modular Structure (`_modules/` — RN flavor)

```
src/ (or root)
├── index.js             # Entry point
├── App.tsx              # Root navigator / provider mount (routing only)
├── config.js            # Runtime configuration
├── _modules/            # Framework-agnostic business logic (100% portable)
│   ├── _api/            # baseFetch, apiClient[Domain], apiUrl, utilsApi
│   ├── common/
│   │   ├── components/  # Col, Row, TextPrimary, Base* components
│   │   ├── context/     # React Context providers (Auth, etc.)
│   │   ├── hooks/       # Reusable hooks
│   │   ├── schemas/     # Zod schemas
│   │   └── utils/       # Pure utilities
│   ├── config/          # Configuration constants
│   ├── screens/         # Screen components (ALL business logic)
│   │   └── [Name]/[Name]Screen.tsx + components/
│   └── values/          # enums, theme, routes, dummy data
├── app/                 # Expo Router routes (routing ONLY) — see 03-navigation
└── services/            # Native/platform services (Audio, WebSocket, camera, …)
```

**Routing layer is thin.** `app/` (Expo Router) or `App.tsx` files only import and render a Screen from
`_modules/screens/`. All hooks, state, and logic live in the Screen. (Same rule as web — see
`ai/shared-fe/01`.)

## Build & Run

```sh
yarn install
npx expo start --dev-client        # dev server (custom dev client)

yarn android                       # expo run:android
yarn ios                           # expo run:ios

# Build a dev client (REQUIRED — app uses native modules, cannot use Expo Go)
npx eas build --platform android --profile development
npx eas build --platform ios     --profile development
```

> **Cannot run in Expo Go** when native modules are present — build a custom dev client via EAS.

## State Management
- **TanStack Query** — API/server state + global cache (`staleTime: Infinity` for near-static data).
- **React Context Provider** — global app state (auth, settings, theme); no external store.
- **React Hook Form** — form state.
- **AsyncStorage** — persistent client state (async; see `04-data-and-storage.md`).
- **`useState`** — local UI state only.

Data flow: `baseFetch → apiClient* → useQuery/useMutation → Screens`, with Context for cross-cutting
global state.

## Environment Configuration
- Runtime config in `config.js` (e.g. `API_KEY`, `MODEL_NAME`, audio toggles).
- **Client-readable env vars must be prefixed `EXPO_PUBLIC_`** (e.g. `EXPO_PUBLIC_API_BASE_URL`).

## Enums & Constants (RN specifics)
Follows `ai/shared-fe/04` (E-prefixed enums, const objects over string literals). RN adds:
- **`EAsyncStorageKey`** — typed keys for AsyncStorage (`AUTH_TOKEN`, `USER_PREFS`, …).
- **Route constants** in `_modules/values/routes.ts` (Expo Router paths — see `03-navigation`).
- **Theme-coupled enum maps** (label/color per enum value) reference `values/theme` — see `02-styling`.

```ts
// _modules/values/enums.ts
export enum EAsyncStorageKey {
  AUTH_TOKEN    = 'auth_token',
  USER_PREFS    = 'user_prefs',
  GUEST_CART_ID = 'guest_cart_id',
}
```

## RN house rules
- Prefer **TypeScript** — do not create new `.js` files.
- Do **not** use a barrel/`index` file to re-export many components.
- Always `StyleSheet.create({})` — never inline style objects (see `02-styling`).
