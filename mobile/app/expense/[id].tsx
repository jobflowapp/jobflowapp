// mobile/app/expense/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Screen, { COLORS, SPACING } from "../../components/Screen";
import { deleteExpense, getExpenses } from "../../lib/api";

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function EditExpenseScreen() {
  const params = useLocalSearchParams();
  const id = useMemo(() => toNum(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const all = await getExpenses();
      const item = (all ?? []).find((x: any) => Number(x.id) === id);
      if (!item) {
        Alert.alert("Not found", "Expense not found.");
        router.back();
        return;
      }
      setAmount(String(item.amount ?? ""));
      setNote(String(item.note ?? ""));
    } catch (e: any) {
      Alert.alert("Load failed", String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!id) {
    return (
      <Screen title="Expense" scroll>
        <Text style={styles.muted}>Missing expense id.</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Edit Expense" loading={loading} scroll padding={SPACING.md}>
      <View style={styles.card}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={COLORS.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional note"
          placeholderTextColor={COLORS.muted}
          style={styles.input}
        />

        <View style={{ height: 18 }} />

        <Text
          onPress={() => {
            Alert.alert("Delete expense?", "This will remove the expense.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    setSaving(true);
                    await deleteExpense(id);
                    Alert.alert("Deleted", "Expense removed.");
                    router.back();
                  } catch (e: any) {
                    Alert.alert("Delete failed", String(e?.message ?? e));
                  } finally {
                    setSaving(false);
                  }
                },
              },
            ]);
          }}
          style={[styles.delete, saving && { opacity: 0.6 }]}
        >
          Delete expense
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: COLORS.muted, fontWeight: "700" },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16 },
  label: { color: COLORS.muted, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  delete: { color: "#EF4444", fontWeight: "900", marginTop: 10 },
});