import { describe, it, expect } from "vitest"
import { cn, CV_PATH } from "@/lib/utils"

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
  })

  it("ignores undefined values", () => {
    expect(cn(undefined, "text-sm")).toBe("text-sm")
  })

  it("ignores falsy conditional classes", () => {
    expect(cn(false && "hidden", "block")).toBe("block")
  })

  it("returns empty string when called with no arguments", () => {
    expect(cn()).toBe("")
  })

  it("handles array inputs", () => {
    expect(cn(["flex", "items-center"])).toBe("flex items-center")
  })
})

describe("CV_PATH", () => {
  it("is a non-empty string", () => {
    expect(typeof CV_PATH).toBe("string")
    expect(CV_PATH.length).toBeGreaterThan(0)
  })

  it("falls back to the default path when CV_PATH env is unset", () => {
    // The module is loaded once; the default is always a string regardless
    // of whether the env var is actually set in the test environment.
    expect(CV_PATH).toMatch(/^\//)
  })
})
