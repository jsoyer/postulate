/**
 * AppCard - compact card representation of an Application.
 *
 * Used in the Applications list and Dashboard recent activity.
 *
 * TODO: Show company, position, status badge, and created_at date.
 * TODO: Add press handler to navigate to AppDetailScreen.
 * TODO: Add swipe actions (delete, change status) via react-native-swipeable.
 * TODO: Add deadline warning indicator when deadline is approaching.
 */

import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"
import { StatusBadge } from "./StatusBadge"
import type { Application } from "../api/types"

interface AppCardProps {
  application: Application
  onPress?: () => void
}

export function AppCard({ application, onPress }: AppCardProps): React.JSX.Element {
  // TODO: Format created_at date with locale-aware formatting.
  // TODO: Add visual deadline indicator.

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.company} numberOfLines={1}>
          {application.company}
        </Text>
        <StatusBadge status={application.status} compact />
      </View>
      <Text style={styles.position} numberOfLines={1}>
        {application.position}
      </Text>
      <Text style={styles.date}>{application.created_at}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  company: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  position: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
})
