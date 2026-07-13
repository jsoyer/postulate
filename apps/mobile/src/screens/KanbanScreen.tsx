/**
 * Kanban board screen.
 *
 * TODO: Render horizontal scrollable columns: applied | interview | offer | rejected | ghosted.
 * TODO: Drag-and-drop cards between columns to update status.
 * TODO: Show application count per column in header.
 * TODO: Implement using react-native-draggable-flatlist or similar.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"

export default function KanbanScreen(): React.JSX.Element {
  // TODO: const { data: applications } = useApplications()
  // TODO: Group applications by status into columns.

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kanban</Text>
      <Text style={styles.subtitle}>TODO: Implement kanban board</Text>
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
