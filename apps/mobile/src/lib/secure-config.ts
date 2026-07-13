import * as SecureStore from 'expo-secure-store'

const KEYS = {
  apiUrl: 'cv_api_url',
  apiKey: 'cv_api_key',
} as const

export interface SecureConfig {
  apiUrl: string
  apiKey: string
}

export async function getSecureConfig(): Promise<SecureConfig | null> {
  const [apiUrl, apiKey] = await Promise.all([
    SecureStore.getItemAsync(KEYS.apiUrl),
    SecureStore.getItemAsync(KEYS.apiKey),
  ])
  if (!apiUrl || !apiKey) return null
  return { apiUrl, apiKey }
}

export async function setSecureConfig(apiUrl: string, apiKey: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.apiUrl, apiUrl),
    SecureStore.setItemAsync(KEYS.apiKey, apiKey),
  ])
}

export async function clearSecureConfig(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.apiUrl),
    SecureStore.deleteItemAsync(KEYS.apiKey),
  ])
}
