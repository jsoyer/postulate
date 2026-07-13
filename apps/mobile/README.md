# cv-mobile

Mobile client for the CV management system. Connects to cv-api to manage job applications, run CV generation actions, and visualize pipeline stats - all from your phone.

> **Status**: Scaffold / work in progress. Core screens are stubs; no real data fetching is implemented yet.

---

## Architecture

```
cv-mobile (React Native / Expo)
    |
    | HTTP REST  (CvApiClient)
    | WebSocket  (action streaming)
    v
cv-api  (Go HTTP server)
    |
    | filesystem / git
    v
CV project  (LaTeX sources + Makefile targets)
```

**Related repositories**

| Repo | Description |
|------|-------------|
| [cv-api](https://github.com/jeromesoyer/cv-api) | Go HTTP/WebSocket API server |
| [cv-manager](https://github.com/jeromesoyer/cv-manager) | Next.js web dashboard |
| [cv-tui-go](https://github.com/jeromesoyer/cv-tui-go) | Terminal UI (Go / Bubbletea) |
| [cv-tui-rs](https://github.com/jeromesoyer/cv-tui-rs) | Terminal UI (Rust / Ratatui) |

---

## Features (planned)

All items below are planned. See the [Roadmap](#roadmap) section for implementation status.

- **Dashboard** - summary stats, recent applications, API health indicator
- **Applications list** - searchable, filterable list with swipe actions
- **Kanban board** - drag-and-drop cards across status columns
- **Actions runner** - trigger Makefile targets with real-time streamed output
- **Stats** - funnel chart and timeline bar chart
- **Application detail** - full fields, file previews, inline status update
- **Push notifications** - notify on long-running action completion
- **QR config** - scan a QR code to configure API URL and key without typing
- **Biometric auth** - Face ID / fingerprint to unlock the app
- **Offline support** - cached reads with sync on reconnect

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.83 + Expo SDK 55 |
| Language | TypeScript (strict mode) |
| Routing | expo-router (file-based) |
| Data fetching | TanStack React Query v5 |
| Navigation | React Navigation v7 (bottom tabs) |
| Secure storage | expo-secure-store |
| Theme | Catppuccin Mocha (consistent with TUI clients) |
| CI | GitHub Actions |

---

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Expo Go app on your device, **or** Xcode (iOS Simulator) / Android Studio (Android emulator)
- A running instance of [cv-api](https://github.com/jeromesoyer/cv-api)

---

## Quick start

```bash
# Clone the repository
git clone https://github.com/jeromesoyer/cv-mobile
cd cv-mobile

# Install dependencies
npm install

# Start the dev server
npx expo start
```

Press `i` for iOS Simulator, `a` for Android emulator, or scan the QR code with Expo Go.

---

## Configuration

API connection settings are stored securely via `expo-secure-store` and are never committed to source control.

**First launch** (not yet implemented - TODO):

On first launch the app will display an onboarding screen asking for:

| Field | Description | Example |
|-------|-------------|---------|
| API URL | Base URL of the cv-api instance | `http://192.168.1.10:3001` |
| API Key | Secret key configured in cv-api | `your-api-key-here` |

A reference template is provided at `config.example.json`:

```json
{
  "apiUrl": "http://localhost:3001",
  "apiKey": "your-api-key-here"
}
```

For local development you can point to a cv-api running on your machine. Use your machine's LAN IP (not `localhost`) when running on a physical device.

---

## Project structure

```
cv-mobile/
├── app.json                    # Expo configuration
├── App.tsx                     # Root component (NavigationContainer)
├── index.ts                    # Expo entry point
├── config.example.json         # Configuration template
├── tsconfig.json               # TypeScript config (strict: true)
├── package.json
├── assets/                     # Icons and splash screen images
├── .github/
│   └── workflows/
│       └── ci.yml              # TypeScript check + lint
└── src/
    ├── api/
    │   ├── types.ts            # Shared API types (mirrors cv-api shapes)
    │   ├── client.ts           # CvApiClient HTTP class
    │   └── hooks.ts            # React Query hooks (useApplications, etc.)
    ├── screens/
    │   ├── DashboardScreen.tsx
    │   ├── ApplicationsScreen.tsx
    │   ├── KanbanScreen.tsx
    │   ├── ActionsScreen.tsx
    │   ├── StatsScreen.tsx
    │   └── AppDetailScreen.tsx
    ├── components/
    │   ├── StatusBadge.tsx     # Colored pill for ApplicationStatus
    │   ├── AppCard.tsx         # List row card for an Application
    │   └── ActionRunner.tsx    # Target runner with output stream
    ├── theme/
    │   ├── colors.ts           # Catppuccin Mocha palette
    │   └── index.ts            # Composed theme object
    └── navigation/
        └── TabNavigator.tsx    # 5-tab bottom navigator
```

---

## Roadmap

> NOT YET IMPLEMENTED. Items are listed in rough priority order.

### Phase 1 - Core plumbing

- [ ] `CvApiClient` - implement all HTTP methods
- [ ] Config storage - `expo-secure-store` read/write for `apiUrl` and `apiKey`
- [ ] Onboarding screen - first-launch API URL configuration
- [ ] React Query setup - `QueryClient` with sensible defaults
- [ ] `CvApiClientProvider` - React context providing the client instance
- [ ] All `hooks.ts` stubs implemented

### Phase 2 - Screens

- [ ] DashboardScreen - real data, pull-to-refresh
- [ ] ApplicationsScreen - FlatList, search bar, filter by status
- [ ] AppDetailScreen - full detail view, inline status picker
- [ ] KanbanScreen - horizontal scroll, drag-and-drop
- [ ] ActionsScreen - target list grouped by category
- [ ] ActionRunner - WebSocket output streaming
- [ ] StatsScreen - funnel + timeline charts

### Phase 3 - Polish

- [ ] Icons - @expo/vector-icons or lucide-react-native
- [ ] Haptic feedback on tab press and status changes
- [ ] Biometric lock screen (expo-local-authentication)
- [ ] QR code config scanner
- [ ] Push notifications for action completion
- [ ] Offline read cache with background sync
- [ ] Dark/light theme toggle (Catppuccin Latte for light)
- [ ] iPad layout with split-view

### Phase 4 - Release

- [ ] App Store listing preparation
- [ ] TestFlight beta distribution
- [ ] EAS Build configuration
- [ ] Crash reporting (Sentry)
- [ ] Analytics

---

## Development notes

### API types

`src/api/types.ts` mirrors `cv-manager/src/lib/api-types.ts`. When cv-api schema changes, update both files. A future improvement would be to generate types from the OpenAPI spec.

### Theme

All colors come from Catppuccin Mocha (`src/theme/colors.ts`). This matches the palette used in cv-tui-go and cv-tui-rs for visual consistency across all clients.

### TypeScript

Strict mode is enabled. All `TODO` hooks intentionally throw `Error("Not implemented")` rather than returning fake data to make incomplete code obvious at runtime.

---

## License

MIT
