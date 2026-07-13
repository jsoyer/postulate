/**
 * Application theme object.
 *
 * TODO: Add typography scale, spacing system, border radii, and shadow presets.
 * TODO: Add light mode variant (Catppuccin Latte).
 */

import { CatppuccinMocha, statusColors } from "./colors"

export const theme = {
  colors: {
    ...CatppuccinMocha,
    // Semantic aliases
    background: CatppuccinMocha.base,
    surface: CatppuccinMocha.surface0,
    surfaceRaised: CatppuccinMocha.surface1,
    border: CatppuccinMocha.surface2,
    textPrimary: CatppuccinMocha.text,
    textSecondary: CatppuccinMocha.subtext0,
    textMuted: CatppuccinMocha.overlay1,
    accent: CatppuccinMocha.mauve,
    success: CatppuccinMocha.green,
    warning: CatppuccinMocha.yellow,
    error: CatppuccinMocha.red,
    info: CatppuccinMocha.blue,
    status: statusColors,
  },
  // TODO: spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }
  // TODO: radii: { sm: 4, md: 8, lg: 12, full: 9999 }
  // TODO: typography: { ... }
} as const

export type Theme = typeof theme
export { CatppuccinMocha, statusColors } from "./colors"
