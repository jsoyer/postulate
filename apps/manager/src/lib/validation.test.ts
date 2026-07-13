import { describe, it, expect } from "vitest"
import { SettingsSchema } from "./validation"

describe("SettingsSchema", () => {
  it("accepts pdfa_enabled boolean field", () => {
    const result = SettingsSchema.safeParse({ theme: "light", pdfa_enabled: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pdfa_enabled).toBe(true)
    }
  })

  it("accepts pdfa_enabled: false", () => {
    const result = SettingsSchema.safeParse({ default_view: "list", pdfa_enabled: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pdfa_enabled).toBe(false)
    }
  })

  it("accepts settings without pdfa_enabled", () => {
    const result = SettingsSchema.safeParse({ theme: "dark", default_view: "board" })
    expect(result.success).toBe(true)
  })
})
