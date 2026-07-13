# cv-mobile Roadmap

Product roadmap for cv-mobile, a React Native/Expo mobile app for CV management. Tracks planned features, improvements, and polish items.

Last updated: March 2026

---

## Core Infrastructure

Essential APIs, data handling, and configuration.

- [ ] Implement CvApiClient HTTP methods (all endpoints)
- [ ] Configure secure storage with expo-secure-store for API URL and key
- [ ] Implement onboarding screen for first-launch API configuration
- [ ] Set up React Query QueryClient with sensible defaults (cache, stale time)
- [ ] Create CvApiClientProvider React context for dependency injection
- [ ] Implement all React Query hooks (useApplications, useDashboard, etc.)
- [ ] Add request/response interceptors for auth token refresh
- [ ] Add WebSocket connection for streaming action output

## Core Features

Fundamental features that drive user value.

- [ ] Dashboard screen with summary stats (total, by-status counts, recent apps)
- [ ] Applications list with FlatList, search bar, and filter by status
- [ ] Application detail screen with full fields, file previews, and inline status picker
- [ ] Kanban board with horizontal scroll and drag-and-drop status changes
- [ ] Actions screen with target list grouped by category
- [ ] ActionRunner component with WebSocket streaming and real-time output display
- [ ] Stats screen with funnel chart and timeline bar chart
- [ ] Pull-to-refresh functionality on all data screens

## Navigation & Deep Linking

Navigation infrastructure and routing improvements.

- [ ] Add proper tab bar icons using @expo/vector-icons or lucide-react-native
- [ ] Implement stack navigator for detail screens (AppDetailScreen modal)
- [ ] Add tab badge showing count of active applications
- [ ] Implement deep linking for direct navigation (e.g., cv-mobile://app/linkedin-2025)
- [ ] Add navigation history tracking and back button handling
- [ ] Implement bottom sheet modal for quick actions

## User Experience & Polish

UI refinements and native feel improvements.

- [ ] Add haptic feedback on tab press and status changes
- [ ] Implement swipe gestures for status transitions in applications list
- [ ] Add loading states and skeleton screens during data fetching
- [ ] Implement error boundaries with user-friendly error messages
- [ ] Add animations for screen transitions (fade, slide)
- [ ] Design and implement onboarding tour for first-time users
- [ ] Add visual feedback for optimistic updates (status change before API response)

## Theme & Accessibility

Dark/light mode and accessibility standards.

- [ ] Implement light theme using Catppuccin Latte palette
- [ ] Add theme toggle in settings with persistent user preference
- [ ] Ensure WCAG AA compliance (color contrast, touch targets)
- [ ] Add screen reader support (AccessibilityLabel, accessible text hierarchy)
- [ ] Support large text sizes via accessibility settings
- [ ] Test on both iOS and Android with accessibility tools

## Authentication & Security

Biometric authentication and secure credential management.

- [ ] Implement biometric lock screen (expo-local-authentication) for app unlock
- [ ] Add support for Face ID on iOS and fingerprint/face on Android
- [ ] Store API key securely in device keychain (expo-secure-store)
- [ ] Implement token expiration and refresh logic
- [ ] Add certificate pinning for API communication (if applicable)
- [ ] Implement automatic session timeout after inactivity

## Platform-Specific Features

iOS and Android native capabilities.

- [ ] iOS: Configure app icons and splash screens for all resolutions
- [ ] iOS: Support iPad split-view layouts with adaptive navigation
- [ ] iOS: Implement app shortcuts for quick actions (lock, sync, etc.)
- [ ] Android: Optimize for notch and hole-punch displays
- [ ] Android: Implement notification channels for grouped notifications
- [ ] Android: Test with Android back gesture handling
- [ ] Both: Implement share extension for sharing application details

## Notifications & Background

Push notifications and background sync.

- [ ] Set up push notification infrastructure (Expo Notifications)
- [ ] Implement notification on action completion (long-running targets)
- [ ] Add background task for periodic data refresh (React Native Background Tasks)
- [ ] Implement optimistic updates with background sync on reconnection
- [ ] Add notification permission request with clear rationale
- [ ] Test notification delivery on both iOS and Android
- [ ] Handle notification interaction and deep linking from notification taps

## Data & Offline

Offline-first architecture and caching strategies.

- [ ] Implement local SQLite database for offline reads (expo-sqlite)
- [ ] Add offline indicator showing when app is sync-pending
- [ ] Implement automatic sync when connection is restored
- [ ] Cache GET responses with configurable TTL per query type
- [ ] Add manual sync button for user-initiated refresh
- [ ] Implement conflict resolution for offline mutations
- [ ] Track data freshness and show "last synced" timestamp

## QA & Testing

Automated testing and device validation.

- [ ] Set up Jest for unit tests of utility functions and hooks
- [ ] Add React Testing Library tests for components
- [ ] Set up Detox for end-to-end testing on iOS Simulator and Android emulator
- [ ] Create device test plan for iPhone, iPad, and Android tablets
- [ ] Test on low-bandwidth and offline scenarios
- [ ] Implement performance profiling and memory leak detection
- [ ] Add visual regression testing for UI changes

## CI/CD & Release

Build automation and deployment infrastructure.

- [ ] Configure EAS Build for iOS and Android binary builds
- [ ] Set up TestFlight beta distribution for iOS
- [ ] Set up Google Play internal testing track for Android
- [ ] Implement Sentry integration for crash reporting and error tracking
- [ ] Add analytics tracking (e.g., Amplitude or Mixpanel)
- [ ] Create release checklist and changelog automation
- [ ] Configure automatic version bumping and tagging via CI
- [ ] Set up app store listing with screenshots, description, and privacy policy

## Developer Experience

Tools and documentation for contributors.

- [ ] Add Storybook for component library and visual testing
- [ ] Create component library with reusable design system
- [ ] Generate API types from cv-api OpenAPI spec (when available)
- [ ] Add ESLint and Prettier configuration for code consistency
- [ ] Create contributing guide with setup and development workflows
- [ ] Add debugging guide for common issues (Flipper, React DevTools)
- [ ] Document component architecture and state management patterns
- [ ] Add TypeScript strict mode validation in CI

## Future Enhancements

Advanced features for future consideration.

- [ ] QR code scanner for API configuration without typing
- [ ] Voice input for creating new applications
- [ ] AI-powered application suggestions based on user history
- [ ] Integration with calendar apps for interview scheduling
- [ ] Sync with email for CV request tracking
- [ ] Custom application templates for frequently applied roles
- [ ] Collaboration features (share application data with contacts)
- [ ] Analytics dashboard showing application funnel metrics
- [ ] Export data to CSV/PDF for backup or sharing
- [ ] Sync with cv-manager web dashboard in real-time

## CV Integration

Features enabling mobile integration with cv-manager and cv-api enhancements.

### Theme Support

- [ ] Theme selector screen -- settings page showing 4 theme options (tech-blue, startup-orange, executive-dark, cyber-red) with live color preview swatches
- [ ] PDF export with theme -- when exporting CV, allow choosing theme before generation
- [ ] Persist theme preference -- store user's preferred theme in secure storage for all future exports

### Data Quality

- [ ] CV health summary card -- dashboard card showing overall health score (0-100) gauge, top 3 improvement suggestions, tap to view full audit
- [ ] Health detail screen -- full audit report with 7 metrics, highlighted duplicate bullets (swipe to dismiss), recommended fixes
- [ ] Health score badge -- show green/yellow/red indicator on dashboard and application list based on audit score
- [ ] Push notification on low score -- notify user when audit score drops below configurable threshold

### AI Transparency

- [ ] Provider status indicator -- show which AI provider was used in application metadata view
- [ ] API client theme support -- `CvApiClient.listThemes()`, `CvApiClient.previewWithTheme(name, theme)` methods
- [ ] useHealthAudit hook -- React hook returning audit data for a given application

---

## Implementation Notes

### Phase 1: Core Plumbing (MVP)

Focus on infrastructure and basic functionality. Estimated 2-3 weeks.

- Implement all API client methods
- Set up configuration flow and secure storage
- Build React Query integration
- Create stub screen UIs

### Phase 2: Core Features (Public Beta)

Build out all main screens with real data binding. Estimated 3-4 weeks.

- Connect all screens to API data
- Implement list, detail, and action runner functionality
- Add pull-to-refresh and loading states
- Test API integration end-to-end

### Phase 3: Polish & Platform

Native refinements and platform-specific features. Estimated 2-3 weeks.

- Add icons, animations, and haptic feedback
- Implement theme toggle and accessibility features
- Optimize for iOS and Android
- Add biometric authentication

### Phase 4: Release

Prepare for production deployment. Estimated 1-2 weeks.

- Set up EAS Build and app store configuration
- Add crash reporting and analytics
- Create release notes and store listings
- Coordinate beta testing and feedback collection

---

## Success Metrics

- [ ] App launches without errors on iOS 14+ and Android 10+
- [ ] All screens load real data within 2 seconds on 4G
- [ ] 100% TypeScript strict mode compliance
- [ ] Test coverage > 70% for critical paths
- [ ] Accessibility score > 90 on Lighthouse
- [ ] App store rating > 4.0 stars with 100+ reviews
- [ ] < 1% crash rate in production
- [ ] < 50MB app size (APK/IPA)

---

## Related Projects

- [cv-api](https://github.com/jeromesoyer/cv-api) - Go HTTP/WebSocket API server
- [cv-manager](https://github.com/jeromesoyer/cv-manager) - Next.js web dashboard
- [cv-tui-go](https://github.com/jeromesoyer/cv-tui-go) - Terminal UI (Go / Bubbletea)
- [cv-tui-rs](https://github.com/jeromesoyer/cv-tui-rs) - Terminal UI (Rust / Ratatui)
