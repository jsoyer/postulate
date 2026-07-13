/**
 * StatusBadge - displays an ApplicationStatus as a colored pill.
 *
 * TODO: Implement styled badge with Catppuccin status colors.
 * TODO: Add optional icon per status (checkmark, clock, etc.).
 * TODO: Support compact variant for use in lists.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"
import type { ApplicationStatus } from "../api/types"

interface StatusBadgeProps {
  status: ApplicationStatus
  compact?: boolean
}

export function StatusBadge({ status, compact: _compact }: StatusBadgeProps): React.JSX.Element {
  // TODO: Use theme.colors.status[status] for background color.
  // TODO: Adjust text/background contrast for readability.

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    // TODO: backgroundColor: theme.colors.status[status]
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    alignSelf: "flex-start",
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
})
