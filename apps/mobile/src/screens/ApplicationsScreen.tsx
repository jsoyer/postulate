/**
 * Applications list screen.
 *
 * TODO: Render paginated/scrollable list of applications.
 * TODO: Add search/filter by status and company.
 * TODO: Swipe-to-delete with confirmation.
 * TODO: FAB to create new application.
 * TODO: Tap row to navigate to AppDetailScreen.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"

export default function ApplicationsScreen(): React.JSX.Element {
  // TODO: const { data: applications, isLoading, refetch } = useApplications()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Applications</Text>
      <Text style={styles.subtitle}>TODO: Implement applications list</Text>
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
