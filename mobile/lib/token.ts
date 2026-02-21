// mobile/lib/token.ts
import * as SecureStore from "expo-secure-store"

const TOKEN_KEY = "jobflow_access_token"

export async function getToken(): Promise<string | null> {
  try {
    const tok = await SecureStore.getItemAsync(TOKEN_KEY)
    return tok ?? null
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    if (!token) return
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    // ignore
  }
}
