import type { Preview } from "@storybook/react"
import "../src/app/globals.css"

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0f172a" },
      ],
    },
  },
}

export default preview
