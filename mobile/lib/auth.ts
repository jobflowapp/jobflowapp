// mobile/lib/auth.ts
import { request } from "./api";
import { setToken, clearToken } from "./token";
import * as SecureStore from "expo-secure-store";

const USER_ID_KEY = "jobflow_user_id";

export type AuthResponse = {
  token: string;
  userId: number;
};

export {getToken, setToken, clearToken } from "./token";

export async function setAuth(token: string, userId: number) {
  await setToken(token);
  await SecureStore.setItemAsync(USER_ID_KEY, String(userId));
}

export async function getUserId(): Promise<number | null> {
  try {
    const v = await SecureStore.getItemAsync(USER_ID_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export async function clearAuth() {
  await clearToken();
  try {
    await SecureStore.deleteItemAsync(USER_ID_KEY);
  } catch {
    // ignore
  }
}

export async function login(email: string, password: string) {
  const res = await request<AuthResponse>("/auth/login", "POST", { email, password });
  await setAuth(res.token, res.userId);
  return res;
}

export async function signup(email: string, password: string, full_name?: string) {
  const res = await request<AuthResponse>("/auth/signup", "POST", {
    email,
    password,
    full_name: full_name ?? null,
  });
  await setAuth(res.token, res.userId);
  return res;
}

export async function deleteAccount() {
  await request<{ ok: boolean }>("/users/me", "DELETE");
  await clearAuth();
}
