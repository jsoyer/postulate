/**
 * Stats screen - visualize application funnel and activity over time.
 *
 * TODO: Render funnel chart (applied -> interview -> offer).
 * TODO: Render timeline bar chart (applications over time).
 * TODO: Add date range picker for timeline filtering.
 * TODO: Implement using Victory Native or react-native-chart-kit.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"

export default function StatsScreen(): React.JSX.Element {
  // TODO: const { data: stats } = useStats()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.subtitle}>TODO: Implement statistics charts</Text>
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
