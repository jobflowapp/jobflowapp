import React, { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Screen, { COLORS, RADIUS, SPACING } from "../components/Screen";
import { createVendor, getVendors, type Vendor } from "../lib/api";

export default function VendorsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Vendor[]>([]);
  const [name, setName] = useState("");

  async function load() {
    setLoading(true);
    try {
      setItems(await getVendors());
    } catch (e: any) {
      Alert.alert("Vendors", String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!name.trim()) return;
    try {
      await createVendor({ name: name.trim(), email: null, phone: null, notes: null, default_category: null } as any);
      setName("");
      await load();
    } catch (e: any) {
      Alert.alert("Add failed", String(e?.message ?? e));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <Screen title="Vendors" loading={loading} padding={SPACING.lg}>
      <View style={styles.addRow}>
        <TextInput value={name} onChangeText={setName} placeholder="New vendor name" placeholderTextColor={COLORS.muted} style={styles.input} />
        <TouchableOpacity onPress={add} style={styles.btn}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.title}>{item.name}</Text>
            {item.default_category ? <Text style={styles.sub}>Default: {item.default_category}</Text> : null}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  input: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontWeight: "800" },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 14, justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "900" },
  item: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 },
  title: { color: COLORS.text, fontWeight: "900" },
  sub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
});
