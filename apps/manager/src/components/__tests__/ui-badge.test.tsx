import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, it, expect } from "vitest"
import { Badge } from "@/components/ui/badge"

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Applied</Badge>)
    expect(screen.getByText("Applied")).toBeInTheDocument()
  })

  it("applies default variant class (bg-primary) when no variant is specified", () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText("Default")
    expect(badge.className).toContain("bg-primary")
  })

  it("variant='applied' renders blue classes different from default", () => {
    render(
      <>
        <Badge data-testid="default-badge">Default</Badge>
        <Badge variant="applied" data-testid="applied-badge">Applied</Badge>
      </>
    )
    const defaultBadge = screen.getByTestId("default-badge")
    const appliedBadge = screen.getByTestId("applied-badge")

    expect(appliedBadge.className).toContain("bg-blue-100")
    expect(appliedBadge.className).toContain("text-blue-800")
    expect(appliedBadge.className).not.toContain("bg-primary")
    expect(defaultBadge.className).not.toContain("bg-blue-100")
  })

  it("variant='rejected' renders red/destructive color classes", () => {
    render(<Badge variant="rejected">Rejected</Badge>)
    const badge = screen.getByText("Rejected")
    expect(badge.className).toContain("bg-red-100")
    expect(badge.className).toContain("text-red-800")
  })

  it("variant='outline' renders with outline classes", () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText("Outline")
    expect(badge.className).toContain("text-foreground")
    // outline variant does not set a background-color class from cva
    expect(badge.className).not.toContain("bg-primary")
    expect(badge.className).not.toContain("bg-blue-100")
  })

  it("does not throw when no variant prop is provided", () => {
    expect(() => render(<Badge>No variant</Badge>)).not.toThrow()
    expect(screen.getByText("No variant")).toBeInTheDocument()
  })
})
