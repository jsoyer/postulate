/**
 * Actions screen - run Makefile targets from the mobile app.
 *
 * TODO: List available targets grouped by category.
 * TODO: Allow selecting an application for application-scoped targets.
 * TODO: Show real-time streaming output via WebSocket.
 * TODO: Display run history with status badges.
 * TODO: Add confirmation modal for destructive targets.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"

export default function ActionsScreen(): React.JSX.Element {
  // TODO: const { data: targets } = useTargets()
  // TODO: const runAction = useRunAction()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Actions</Text>
      <Text style={styles.subtitle}>TODO: Implement actions runner</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
})
