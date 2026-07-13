# CV Manager — Handoff Document

> Dernière mise à jour : 2026-03-10. Reprendre le dev sur une nouvelle machine.

## État du projet

Tous les commits sont sur `main` et pushés sur `git@github.com:jsoyer/cv-manager.git`.

```
7586e35 docs: update README and HANDOFF with analytics, Notion, LinkedIn
8bd61d5 feat: rich analytics dashboard + Notion & LinkedIn integrations
a62ddbb docs: add HANDOFF.md
2844304 docs: fix README passkey note and roadmap section
247eaca feat(auth): implement WebAuthn passkey authentication
89ecce2 fix: add useDefaultAI to 13 missing AI action pages
1284c40 chore: complete roadmap 67/67
0ada253 feat: health banner, setup wizard, provider status, E2E, docs
```

---

## Setup sur nouvelle machine

```bash
git clone git@github.com:jsoyer/cv-manager.git
cd cv-manager
npm install
# Créer .env.local (voir ci-dessous)
npm run dev
```

### .env.local complet

```env
# cv-api backend
CV_API_URL=http://localhost:8765
CV_API_KEY=your-api-key

# Auth
AUTH_SECRET=change-me-min-32-chars-random-string
AUTH_USERNAME=jerome
AUTH_PASSWORD=your-password
AUTH_DOMAIN=localhost
AUTH_ORIGIN=http://localhost:3000

# TOTP (optionnel — rend le TOTP obligatoire au login si défini)
# AUTH_TOTP_SECRET=BASE32SECRET

# LinkedIn OAuth (optionnel)
# LINKEDIN_CLIENT_ID=your_linkedin_client_id
# LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
# NEXTAUTH_URL=http://localhost:3000
```

### Données persistantes à copier si tu changes de machine

```
data/passkey-credentials.json   # Passkeys WebAuthn
data/integrations.json          # Tokens Notion + LinkedIn
```

---

## Architecture

### Stack
- **Next.js 16** App Router, React 19, TypeScript strict
- **Tailwind v4** — `@import "tailwindcss"`, `@theme inline`, **pas de tailwind.config.js**
- **shadcn/ui** installé manuellement dans `src/components/ui/` (23 composants)
- **TanStack React Query v5** — `useQuery`, `useMutation`
- **cv-api** (Go) — backend wrappant le pipeline Makefile CV

### Fichiers clés

```
src/
  lib/
    auth.ts                  # JWT, TOTP, WebAuthn (@simplewebauthn/server v13)
    passkey-store.ts         # Credentials WebAuthn → data/passkey-credentials.json
    integrations-store.ts    # Notion + LinkedIn tokens → data/integrations.json
    api-client.ts            # Client cv-api
    validation.ts            # Schémas Zod
    undo-stack.ts            # Undo/redo (10 ops)
    rate-limiter.ts          # Rate limiting client + exponential backoff
  hooks/
    useDefaultAI.ts          # Lit default_ai/default_model depuis /api/settings
  components/
    ActionRunner.tsx         # Runner SSE pour tous les Make targets
    HealthBanner.tsx         # Banner polling /api/health, liens vers /setup
    CommandPalette.tsx       # Cmd+K (50+ items)
    Sidebar.tsx / BottomNav.tsx
  app/
    login/page.tsx           # Login: password + TOTP progressif + passkey
    setup/page.tsx           # Setup wizard 3 étapes
    stats/page.tsx           # Analytics: heatmap, weekly, pipeline over time, velocity
    settings/page.tsx        # 8 tabs: General/Advanced/AI/Notifications/Data/Appearance/Security/Integrations
    actions/*/page.tsx       # 55 pages d'actions (24 avec AI provider selector)
    api/
      auth/
        login/               # POST password+TOTP
        passkey/register/    # GET options + POST verify
        passkey/challenge/   # GET auth options
        passkey/verify/      # POST verify + session cookie
        passkeys/            # GET list + DELETE
      integrations/
        notion/              # GET status / POST save / DELETE clear
        linkedin/            # GET status / DELETE disconnect
        linkedin/auth/       # GET → redirect OAuth LinkedIn
        linkedin/callback/   # GET → exchange code, save token
        linkedin/post/       # POST → ugcPosts API
      applications/          # CRUD via cv-api
      actions/stream/        # Proxy SSE vers cv-api
      health/                # Health check + ai_providers
      settings/              # GET/POST settings via cv-api
  middleware.ts              # Security headers + JWT enforcement → /login
data/
  passkey-credentials.json   # Auto-créé au premier passkey
  integrations.json          # Auto-créé à la première intégration
e2e/                         # Tests Playwright
.storybook/
docs/
  cv-api-integration.md
  HANDOFF.md                 # Ce fichier
```

---

## Auth

| Méthode | Détails |
|---------|---------|
| Password | username + password via `/api/auth/login` |
| TOTP | Apparaît dynamiquement si `AUTH_TOTP_SECRET` configuré |
| Passkey | WebAuthn (@simplewebauthn v13), credentials dans `data/passkey-credentials.json` |

Enregistrer un passkey : Settings → Security → nom d'appareil → "Register passkey"

---

## Analytics (`/stats`)

| Composant | Description |
|-----------|-------------|
| KPI cards (5) | Total, Response Rate, Interview Rate, Offers, Velocity (apps/semaine) |
| WeeklyBarChart | Nouvelles apps par semaine — 12 dernières semaines |
| PipelineOverTime | Stacked area chart par stage sur le temps |
| CumulativeChart | Cumul total dans le temps |
| StageBarChart | Distribution par stage |
| Heatmap | GitHub-style, 52 semaines |
| Funnel + Conversion | Progress bars + taux applied→interview→offer |

---

## Intégrations

### Notion
1. Créer une intégration sur [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Partager la base de données applications avec l'intégration
3. Settings → Integrations → coller token + database ID
4. `/actions/notion` → notion-pull / notion-push / notion-diff

### LinkedIn OAuth
1. Créer une app LinkedIn sur [linkedin.com/developers](https://www.linkedin.com/developers/)
2. Scope requis : `w_member_social`
3. Callback URL : `http://localhost:3000/api/integrations/linkedin/callback`
4. Ajouter dans `.env.local` : `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`
5. Settings → Integrations → Connect LinkedIn
6. `/actions/linkedin-post` → générer contenu → bouton "Post to LinkedIn"

---

## AI Action Pages (24/55 avec sélecteur AI)

tailor, apply, ai-cover-letter, ai-interview-prep, star, negotiate, thankyou, salary,
recruiter, cold-sequence, blog, brand, research, culture, cover-angles, competitor-map,
interview-brief, interview-debrief, linkedin-message, linkedin-post, linkedin-profile,
prep-star, recruiter-email, salary-bench

---

## Tests

```bash
npm test                  # Vitest unit + component
npm run test:watch
npm run test:coverage
npm run test:e2e          # Playwright
npm run test:e2e:ui
npm run storybook
```

---

## Ce qu'il reste à faire

**Rien d'essentiel.** Pistes si tu veux continuer :
- Export PDF du rapport mensuel
- Notifications email sur changement de stage
- PWA push notifications

---

## Limitations connues (by design)

| Limitation | Raison |
|-----------|--------|
| Pas de rate limiting login | Nécessite une DB externe |
| AUTH_SECRET faible par défaut | À configurer |
| WebAuthn nécessite HTTPS en prod | Localhost fonctionne en HTTP |
| Passkeys liés au domaine | Changer AUTH_DOMAIN invalide les passkeys existants |
| LinkedIn OAuth nécessite une app | Créer sur linkedin.com/developers |
