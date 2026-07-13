/**
 * Root application component.
 *
 * Boot sequence:
 * 1. Check expo-secure-store for saved API config (isConfigured === null while loading).
 * 2. If missing → show OnboardingScreen to collect URL + key.
 * 3. If present → render the full app wrapped in QueryClientProvider.
 *
 * TODO: Switch to expo-router file-based routing once navigation is fleshed out.
 */

import React, { useState, useEffect } from "react"
import { View, ActivityIndicator } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { StatusBar } from "expo-status-bar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TabNavigator } from "./src/navigation/TabNavigator"
import { theme } from "./src/theme"
import { getSecureConfig } from "./src/lib/secure-config"
import OnboardingScreen from "./src/screens/OnboardingScreen"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
})

export default function App(): React.JSX.Element {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    getSecureConfig()
      .then((config) => {
        setIsConfigured(config !== null)
      })
      .catch(() => {
        setIsConfigured(false)
      })
  }, [])

  if (isConfigured === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    )
  }

  if (!isConfigured) {
    return <OnboardingScreen onComplete={() => setIsConfigured(true)} />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: theme.colors.accent,
            background: theme.colors.background,
            card: theme.colors.mantle,
            text: theme.colors.textPrimary,
            border: theme.colors.border,
            notification: theme.colors.red,
          },
          fonts: {
            regular: { fontFamily: "System", fontWeight: "400" },
            medium: { fontFamily: "System", fontWeight: "500" },
            bold: { fontFamily: "System", fontWeight: "700" },
            heavy: { fontFamily: "System", fontWeight: "900" },
          },
        }}
      >
        <StatusBar style="light" backgroundColor={theme.colors.crust} />
        <TabNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  )
}
