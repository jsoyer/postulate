import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "applied",
        "interview",
        "offer",
        "rejected",
        "ghosted",
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: {
    children: "Default",
    variant: "default",
  },
}

export const Secondary: Story = {
  args: {
    children: "Secondary",
    variant: "secondary",
  },
}

export const Destructive: Story = {
  args: {
    children: "Destructive",
    variant: "destructive",
  },
}

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
}

export const Applied: Story = {
  args: {
    children: "Applied",
    variant: "applied",
  },
}

export const Interview: Story = {
  args: {
    children: "Interview",
    variant: "interview",
  },
}

export const Offer: Story = {
  args: {
    children: "Offer",
    variant: "offer",
  },
}

export const Rejected: Story = {
  args: {
    children: "Rejected",
    variant: "rejected",
  },
}

export const Ghosted: Story = {
  args: {
    children: "Ghosted",
    variant: "ghosted",
  },
}

export const ApplicationStatuses: Story = {
  name: "Application Status Variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="applied">Applied</Badge>
      <Badge variant="interview">Interview</Badge>
      <Badge variant="offer">Offer</Badge>
      <Badge variant="rejected">Rejected</Badge>
      <Badge variant="ghosted">Ghosted</Badge>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="applied">Applied</Badge>
      <Badge variant="interview">Interview</Badge>
      <Badge variant="offer">Offer</Badge>
      <Badge variant="rejected">Rejected</Badge>
      <Badge variant="ghosted">Ghosted</Badge>
    </div>
  ),
}
