/**
 * Catppuccin Mocha color palette.
 * Consistent with cv-tui-go, cv-tui-rs, and cv-manager themes.
 *
 * Reference: https://github.com/catppuccin/catppuccin
 */

export const CatppuccinMocha = {
  // Base colors
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",

  // Text
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",

  // Overlay
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",

  // Surface
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",

  // Base
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
} as const

export type CatppuccinColor = keyof typeof CatppuccinMocha

/**
 * Semantic color mapping for application status badges.
 * Maps ApplicationStatus values to Catppuccin Mocha colors.
 */
export const statusColors: Record<string, string> = {
  applied: CatppuccinMocha.blue,
  interview: CatppuccinMocha.yellow,
  offer: CatppuccinMocha.green,
  rejected: CatppuccinMocha.red,
  ghosted: CatppuccinMocha.overlay1,
}
