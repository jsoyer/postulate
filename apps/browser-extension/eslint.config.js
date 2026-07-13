import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // React & hooks
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: { version: "18" },
    },
  },

  // Project-wide settings
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce void for floating promises
      "@typescript-eslint/no-floating-promises": "error",
      // Prefer explicit types on public API
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Allow _unused prefixed params
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // No console.log in production code
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Test files
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Config files
  {
    files: ["*.config.{js,ts}", "vite.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Ignores
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  }
)
