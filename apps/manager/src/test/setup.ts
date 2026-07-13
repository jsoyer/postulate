import "@testing-library/jest-dom"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeAll, afterAll, vi } from "vitest"
import { server } from "./msw-server"

// jsdom does not implement ResizeObserver — provide a no-op stub
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom does not implement scrollIntoView — provide a no-op stub
window.HTMLElement.prototype.scrollIntoView = function () {}

// Start/stop MSW on every test file
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

// Mock next/navigation globally
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "inter" }),
}))
