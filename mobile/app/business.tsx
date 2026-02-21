import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Screen, { COLORS, RADIUS, SPACING } from "../components/Screen";
import { getBusiness, updateBusiness, type BusinessProfile } from "../lib/api";

export default function BusinessScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<BusinessProfile>>({});

  async function load() {
    setLoading(true);
    try {
      const b = await getBusiness();
      setForm(b);
    } catch (e: any) {
      Alert.alert("Business", String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateBusiness({
        name: String(form.name ?? "").trim() || "My Business",
        email: String(form.email ?? "").trim() || null,
        phone: String(form.phone ?? "").trim() || null,
        address_line1: String(form.address_line1 ?? "").trim() || null,
        city: String(form.city ?? "").trim() || null,
        state: String(form.state ?? "").trim() || null,
        postal_code: String(form.postal_code ?? "").trim() || null,
        logo_url: String(form.logo_url ?? "").trim() || null,
        invoice_prefix: String(form.invoice_prefix ?? "INV-").trim() || "INV-",
        default_terms: String(form.default_terms ?? "").trim() || null,
      } as any);
      Alert.alert("Saved", "Business updated.");
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

  const set = (k: keyof BusinessProfile, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Screen title="Business Profile" loading={loading} scroll padding={SPACING.lg}>
      <View style={styles.card}>
        <Text style={styles.label}>Business name</Text>
        <TextInput value={String(form.name ?? "")} onChangeText={(v) => set("name", v)} style={styles.input} placeholder="My Business" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
        <TextInput value={String(form.email ?? "")} onChangeText={(v) => set("email", v)} style={styles.input} placeholder="billing@..." placeholderTextColor={COLORS.muted} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>Phone</Text>
        <TextInput value={String(form.phone ?? "")} onChangeText={(v) => set("phone", v)} style={styles.input} placeholder="(555)..." placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Address line 1</Text>
        <TextInput value={String(form.address_line1 ?? "")} onChangeText={(v) => set("address_line1", v)} style={styles.input} placeholder="123 Main St" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>City</Text>
        <TextInput value={String(form.city ?? "")} onChangeText={(v) => set("city", v)} style={styles.input} placeholder="City" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>State</Text>
        <TextInput value={String(form.state ?? "")} onChangeText={(v) => set("state", v)} style={styles.input} placeholder="NY" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Postal code</Text>
        <TextInput value={String(form.postal_code ?? "")} onChangeText={(v) => set("postal_code", v)} style={styles.input} placeholder="10001" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Logo URL (optional)</Text>
        <TextInput value={String(form.logo_url ?? "")} onChangeText={(v) => set("logo_url", v)} style={styles.input} placeholder="https://..." placeholderTextColor={COLORS.muted} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>Invoice prefix</Text>
        <TextInput value={String(form.invoice_prefix ?? "INV-")} onChangeText={(v) => set("invoice_prefix", v)} style={styles.input} placeholder="INV-" placeholderTextColor={COLORS.muted} />

        <Text style={[styles.label, { marginTop: 12 }]}>Default terms</Text>
        <TextInput value={String(form.default_terms ?? "")} onChangeText={(v) => set("default_terms", v)} style={styles.input} placeholder="Due on receipt" placeholderTextColor={COLORS.muted} />

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
