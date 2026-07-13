/**
 * Application detail screen.
 *
 * TODO: Show all application fields (company, position, status, dates, outcome).
 * TODO: List associated files with preview capability.
 * TODO: Inline status update via picker/segmented control.
 * TODO: Run application-scoped actions from this screen.
 * TODO: Edit mode for updating fields.
 */

import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"

interface AppDetailScreenProps {
  // TODO: route params via expo-router useLocalSearchParams()
  name?: string
}

export default function AppDetailScreen(
  _props: AppDetailScreenProps
): React.JSX.Element {
  // TODO: const { name } = useLocalSearchParams<{ name: string }>()
  // TODO: const { data: application, isLoading } = useApplication(name)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Application Detail</Text>
      <Text style={styles.subtitle}>TODO: Implement application detail</Text>
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
