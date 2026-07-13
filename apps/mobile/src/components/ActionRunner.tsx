/**
 * ActionRunner - button to trigger a Makefile target and display output.
 *
 * TODO: Accept a Target and optional application name.
 * TODO: Show running spinner while action is in progress.
 * TODO: Stream stdout/stderr output in a scrollable terminal-like view via WebSocket.
 * TODO: Show exit code badge on completion.
 * TODO: Support cancellation.
 */

import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { theme } from "../theme"
import type { Target } from "../api/types"

interface ActionRunnerProps {
  target: Target
  applicationName?: string
  onComplete?: (exitCode: number) => void
}

export function ActionRunner({
  target,
  applicationName: _applicationName,
  onComplete: _onComplete,
}: ActionRunnerProps): React.JSX.Element {
  // TODO: const runAction = useRunAction()
  // TODO: const [output, setOutput] = React.useState<string[]>([])
  // TODO: const [isRunning, setIsRunning] = React.useState(false)

  const handlePress = () => {
    // TODO: Connect WebSocket, stream output, call onComplete on exit.
    console.warn("ActionRunner.handlePress: not implemented")
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.targetName}>{target.name}</Text>
        <Text style={styles.category}>{target.category}</Text>
      </View>
      <Text style={styles.description}>{target.description}</Text>
      <Pressable style={styles.button} onPress={handlePress}>
        <Text style={styles.buttonText}>Run</Text>
      </Pressable>
      {/* TODO: <ScrollView style={styles.output}><Text>{output.join("")}</Text></ScrollView> */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
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
  targetName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    fontFamily: "monospace",
  },
  category: {
    fontSize: 12,
    color: theme.colors.accent,
    textTransform: "uppercase",
  },
  description: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: theme.colors.crust,
    fontWeight: "600",
    fontSize: 13,
  },
})
