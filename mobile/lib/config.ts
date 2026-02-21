// mobile/lib/config.ts
import Constants from "expo-constants";

type Extra = { apiBaseUrl?: string };

function readExtra(): Extra {
  const c: any = Constants as any;
  return (
    (Constants.expoConfig?.extra as Extra | undefined) ??
    (c.manifest?.extra as Extra | undefined) ??
    (c.manifest2?.extra as Extra | undefined) ??
    {}
  );
}

const extra = readExtra();

export const API_BASE_URL =
  extra.apiBaseUrl ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://jobflow-backend-bhvw.onrender.com";

// ✅ add this so api.ts stops crashing
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}