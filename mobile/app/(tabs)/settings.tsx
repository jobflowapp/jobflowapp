// mobile/app/(tabs)/settings.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import Screen, { COLORS, RADIUS, SHADOW, SPACING } from "../../components/Screen";
import { clearAuth, getToken } from "../../lib/auth";

type Row = { title: string; route?: string; value?: string };

function RowItem({ title, value, onPress }: { title: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? styles.rowPressed : null,
        !onPress ? styles.rowDisabled : null,
      ]}
      hitSlop={10}
    >
      <Text style={styles.rowText}>{title}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [signedIn, setSignedIn] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (mounted) setSignedIn(!!token);
      } catch {
        if (mounted) setSignedIn(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await clearAuth();
      Alert.alert("Logged out", "You will need to log in again to access your data.");
      router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to log out.");
    }
  };

  const deleteAccount = async () => {
    Alert.alert(
      "Delete account",
      "This will remove your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // NOTE: If you later add a backend endpoint to delete the user,
            // call it here, THEN clearAuth() and route to login.
            await clearAuth();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  const appRows: Row[] = useMemo(
    () => [
      { title: "My Profile", route: "/profile" },
      { title: "Business Profile", route: "/business" },
      { title: "Clients", route: "/clients" },
      { title: "Vendors", route: "/vendors" },
      { title: "App", value: "JobFlow" },
      { title: "Theme", value: "Dark" },
      { title: "Version", value: "1.0.0" },
    ],
    []
  );

  return (
    <Screen title="Settings" subtitle="Account & app preferences">
      {/* Account Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <View style={styles.subCard}>
          <Text style={styles.subTitle}>{signedIn ? "Signed in" : "Signed out"}</Text>
          <Text style={styles.subText}>
            {signedIn ? "Your session token is stored securely" : "Please log in to access your data"}
          </Text>
        </View>

        <Pressable onPress={logout} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
          <Text style={styles.btnText}>Log out</Text>
        </Pressable>

        <Pressable
          onPress={deleteAccount}
          style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>Delete account</Text>
        </Pressable>
      </View>

      {/* App Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App</Text>

        {appRows.map((r) => (
          <RowItem
            key={r.title}
            title={r.title}
            value={r.value}
            onPress={
              r.route
                ? () => {
                    router.push(r.route as any);
                  }
                : undefined
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: SPACING.md,
  },

  subCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  subTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  subText: {
    marginTop: 6,
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 13,
  },

  btn: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  btnDanger: {
    opacity: 0.95,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  row: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  rowText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 15,
  },
  rowValue: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 15,
  },
});