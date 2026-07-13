import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { describe, it, expect } from "vitest"
import { CommandPalette } from "@/components/CommandPalette"
import { TooltipProvider } from "@/components/ui/tooltip"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPalette() {
  return render(
    <TooltipProvider>
      <CommandPalette />
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommandPalette", () => {
  it("dialog is not visible initially — no input in the document", () => {
    renderPalette()
    expect(
      screen.queryByPlaceholderText("Search pages and actions...")
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("pressing Ctrl+K opens the dialog and shows the search input", async () => {
    renderPalette()

    fireEvent.keyDown(document, { key: "k", ctrlKey: true })

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Search pages and actions...")
      ).toBeInTheDocument()
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("typing 'Settings' in the open palette shows the Settings item", async () => {
    const user = userEvent.setup()
    renderPalette()

    fireEvent.keyDown(document, { key: "k", ctrlKey: true })

    const input = await screen.findByPlaceholderText(
      "Search pages and actions..."
    )

    await user.type(input, "Settings")

    await waitFor(() =>
      expect(screen.getAllByText("Settings").length).toBeGreaterThan(0)
    )
  })

  it("typing 'zzz' shows 'No results found.'", async () => {
    const user = userEvent.setup()
    renderPalette()

    fireEvent.keyDown(document, { key: "k", ctrlKey: true })

    const input = await screen.findByPlaceholderText(
      "Search pages and actions..."
    )

    await user.type(input, "zzz")

    await waitFor(() =>
      expect(screen.getByText("No results found.")).toBeInTheDocument()
    )
  })

  it("pressing Escape closes the dialog", async () => {
    renderPalette()

    // Open first
    fireEvent.keyDown(document, { key: "k", ctrlKey: true })

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    )

    // Close via Escape
    fireEvent.keyDown(document, { key: "Escape" })

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })
})
