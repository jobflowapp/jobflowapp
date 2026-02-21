import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Screen, { COLORS, RADIUS, SPACING } from "../components/Screen";
import { getProfile, updateProfile, type UserProfile } from "../lib/api";

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [rate, setRate] = useState("0.0");

  async function load() {
    setLoading(true);
    try {
      const p: UserProfile = await getProfile();
      setPhone(String(p.phone ?? ""));
      setTimezone(String(p.timezone ?? "America/New_York"));
      setRate(String(p.default_mileage_rate ?? 0));
    } catch (e: any) {
      Alert.alert("Profile", String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        phone: phone.trim() || null,
        timezone: timezone.trim() || null,
        default_mileage_rate: Number(rate) || 0,
      });
      Alert.alert("Saved", "Profile updated.");
      router.back();
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen title="My Profile" loading={loading} scroll padding={SPACING.lg}>
      <View style={styles.card}>
        <Text style={styles.label}>Phone</Text>
        <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="(555) 555-5555" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Timezone</Text>
        <TextInput value={timezone} onChangeText={setTimezone} style={styles.input} placeholder="America/New_York" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Default mileage rate</Text>
        <TextInput value={rate} onChangeText={setRate} style={styles.input} placeholder="0.0" keyboardType="decimal-pad" placeholderTextColor={COLORS.muted} />

        <TouchableOpacity disabled={saving} onPress={save} style={[styles.btn, saving && { opacity: 0.7 }]}>
          <Text style={styles.btnText}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16 },
  label: { color: COLORS.muted, fontWeight: "800", marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontWeight: "800" },
  btn: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900" },
});
