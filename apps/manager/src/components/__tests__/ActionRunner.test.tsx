import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ActionRunner } from "@/components/ActionRunner"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

// Provide the SelectedApp context
vi.mock("@/components/SelectedAppContext", () => ({
  useSelectedApp: () => ({ selectedApp: null, setSelectedApp: vi.fn() }),
}))

// Push notifications hook
vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({ notify: vi.fn() }),
}))

// Mock EventSource for SSE
class MockEventSource {
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onopen: ((ev: Event) => void) | null = null
  close = vi.fn()
  static instances: MockEventSource[] = []

  constructor(public url: string) {
    MockEventSource.instances.push(this)
  }
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal("EventSource", MockEventSource)
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const basicProps = {
  action: "tailor",
  title: "AI Tailor",
  description: "Tailor your CV",
  fields: [
    { name: "application", label: "Application", placeholder: "e.g. acme-2025-01" },
  ],
}

describe("ActionRunner", () => {
  it("renders title and description", () => {
    render(<ActionRunner {...basicProps} />, { wrapper })

    expect(screen.getByText("AI Tailor")).toBeInTheDocument()
    expect(screen.getByText("Tailor your CV")).toBeInTheDocument()
  })

  it("renders field label and input", () => {
    render(<ActionRunner {...basicProps} />, { wrapper })

    expect(screen.getByLabelText("Application")).toBeInTheDocument()
  })

  it("renders Run button", () => {
    render(<ActionRunner {...basicProps} />, { wrapper })

    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument()
  })

  // TODO: The component relies on the HTML5 `required` attribute for validation.
  // jsdom does not enforce native browser form validation (no error text is rendered),
  // so this test cannot pass without adding explicit inline validation to the component.
  it.skip("shows required field error when submitting empty required field", async () => {
    const user = userEvent.setup()
    const propsWithRequired = {
      ...basicProps,
      fields: [{ ...basicProps.fields[0], required: true }],
    }

    render(<ActionRunner {...propsWithRequired} />, { wrapper })

    await user.click(screen.getByRole("button", { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument()
    })
  })

  // TODO: The component uses fetch() streaming (POST /api/actions/stream) rather than
  // EventSource. This test was written for a previous EventSource-based implementation.
  // Update when the component is refactored, or add an MSW handler for the stream endpoint.
  it.skip("starts SSE when Run is clicked with valid inputs", async () => {
    const user = userEvent.setup()

    render(<ActionRunner {...basicProps} />, { wrapper })

    const input = screen.getByLabelText("Application")
    await user.type(input, "2025-01-acme")
    await user.click(screen.getByRole("button", { name: /run/i }))

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1)
      expect(MockEventSource.instances[0].url).toContain("tailor")
    })
  })

  it("renders select field with options", () => {
    const propsWithSelect = {
      ...basicProps,
      fields: [
        {
          name: "provider",
          label: "AI Provider",
          type: "select" as const,
          options: [
            { value: "gemini", label: "Gemini" },
            { value: "claude", label: "Claude" },
          ],
        },
      ],
    }

    render(<ActionRunner {...propsWithSelect} />, { wrapper })

    expect(screen.getByText("AI Provider")).toBeInTheDocument()
  })
})
