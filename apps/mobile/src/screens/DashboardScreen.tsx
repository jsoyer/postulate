/**
 * Dashboard screen - entry point of the app.
 *
 * TODO: Display summary stats (total apps, by-status counts).
 * TODO: Show recent applications list.
 * TODO: Show API health indicator.
 * TODO: Pull-to-refresh.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"

export default function DashboardScreen(): React.JSX.Element {
  // TODO: const { data, isLoading, error } = useDashboard()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>TODO: Implement dashboard</Text>
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
