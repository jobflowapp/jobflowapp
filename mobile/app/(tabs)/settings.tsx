import React, { useMemo } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Screen from "../../components/Screen";
import { COLORS, SHADOW } from "../../lib/ui";
import { clearAuth, deleteAccount } from "../../lib/auth";
import { router } from "expo-router";

export default function SettingsTab() {
  const rows = useMemo(
    () => [
      { title: "My Profile", onPress: () => router.push("/profile") },
      { title: "Business Profile", onPress: () => router.push("/business") },
      { title: "Clients", onPress: () => router.push("/clients") },
      { title: "Vendors", onPress: () => router.push("/vendors") },
      { title: "App", value: "JobFlow" },
      { title: "Theme", value: "Dark" },
      { title: "Version", value: "1.0.0" },
    ],
    []
  );

  const logout = () => {
    Alert.alert("Log out?", "You’ll need to log in again to access your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await clearAuth();
          router.replace("/login");
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and all jobs, invoices, expenses and mileage. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } finally {
              await clearAuth();
              router.replace("/login");
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <View style={styles.pill}>
          <Text style={styles.pillTitle}>Signed in</Text>
          <Text style={styles.pillSub}>Your session token is stored securely</Text>
        </View>

        <TouchableOpacity style={styles.dangerBtn} onPress={logout}>
          <Text style={styles.dangerText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.dangerBtn, styles.deleteBtn]} onPress={confirmDelete}>
          <Text style={styles.dangerText}>Delete account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App</Text>

        {rows.map((r) => (
          <View key={r.title} style={styles.row}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    ...(SHADOW as any).md,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 10,
  },
  pill: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },
  pillTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  pillSub: { color: COLORS.muted, fontWeight: "700", marginTop: 6 },

  dangerBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  deleteBtn: {
    opacity: 0.9,
  },
  dangerText: { color: "white", fontWeight: "900", fontSize: 15 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowTitle: { color: COLORS.text, fontWeight: "800" },
  rowValue: { color: COLORS.muted, fontWeight: "700" },
});
