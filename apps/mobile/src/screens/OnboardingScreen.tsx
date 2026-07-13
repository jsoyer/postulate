/**
 * Onboarding screen — shown on first launch when no API config is stored.
 *
 * Collects API URL and API key, lets the user test the connection via a
 * health check ping, then persists the config to expo-secure-store.
 */

import React, { useState } from "react"
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { theme } from "../theme"
import { CvApiClient } from "../api/client"
import { setSecureConfig } from "../lib/secure-config"

export interface OnboardingScreenProps {
  onComplete: () => void
}

export default function OnboardingScreen({
  onComplete,
}: OnboardingScreenProps): React.JSX.Element {
  const [apiUrl, setApiUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleTestConnection = async (): Promise<void> => {
    setError(null)
    setSuccessMessage(null)
    setIsTestingConnection(true)
    try {
      const client = new CvApiClient({ baseUrl: apiUrl, apiKey })
      const result = await client.health()
      const version = result.version !== undefined ? ` v${result.version}` : ""
      setSuccessMessage(`Connected! API${version} is ${result.status}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    setError(null)
    setIsSaving(true)
    try {
      await setSecureConfig(apiUrl, apiKey)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration")
      setIsSaving(false)
    }
  }

  const isBusy = isTestingConnection || isSaving

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Configure CV API</Text>
        <Text style={styles.subtitle}>
          Enter your CV API server URL and API key to get started.
        </Text>

        <Text style={styles.label}>API URL</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://your-cv-api.com"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isBusy}
        />

        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="your-api-key"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={true}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isBusy}
        />

        {successMessage !== null && (
          <Text style={styles.success}>{successMessage}</Text>
        )}

        <TouchableOpacity
          style={[styles.button, isBusy && styles.buttonDisabled]}
          onPress={() => {
            void handleTestConnection()
          }}
          disabled={isBusy}
          activeOpacity={0.7}
        >
          {isTestingConnection ? (
            <ActivityIndicator color={theme.colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.buttonText}>Test Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, isBusy && styles.buttonDisabled]}
          onPress={() => {
            void handleSave()
          }}
          disabled={isBusy}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator color={theme.colors.background} size="small" />
          ) : (
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Save & Continue</Text>
          )}
        </TouchableOpacity>

        {error !== null && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 20,
  },
  success: {
    fontSize: 14,
    color: theme.colors.success,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 50,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  buttonTextPrimary: {
    color: theme.colors.background,
  },
  error: {
    fontSize: 14,
    color: theme.colors.error,
    marginTop: 8,
    textAlign: "center",
  },
})
