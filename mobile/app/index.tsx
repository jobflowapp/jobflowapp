import { useEffect } from "react";
import { router, useRootNavigationState } from "expo-router";
import { getToken } from "../lib/auth";

export default function Index() {
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return; // wait for Root Layout mount

    (async () => {
      const token = await getToken();
      router.replace(token ? "/(tabs)" : "/(auth)/login");
    })();
  }, [navState?.key]);

  return null;
}
