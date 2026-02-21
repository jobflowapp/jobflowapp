// mobile/app/(tabs)/expenses.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import Screen from "../../components/Screen";

// ✅ make sure these exist in mobile/lib/api.ts
import { createExpense, deleteExpense, getExpenses, type Expense } from "../../lib/api";

const CATEGORIES = ["Materials", "Fuel", "Tools", "Labor", "Meals", "Other"];

function toJobId(val: unknown): number | null {
  if (val == null) return null;
  const raw = Array.isArray(val) ? val[0] : val;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ExpensesScreen() {
  const params = useLocalSearchParams();
  const jobId = useMemo(() => toJobId(params?.job_id), [params?.job_id]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);

  // form
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string>("Other");

  const total = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  async function load() {
    try {
      const data = await getExpenses(jobId); // null = all
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log("Expenses load error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to load expenses");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function onAdd() {
    const cleanAmount = Number(String(amount).replace(/[^0-9.]/g, ""));
    if (!cleanAmount || cleanAmount <= 0) {
      Alert.alert("Missing amount", "Enter a valid expense amount.");
      return;
    }

    try {
      const created = await createExpense({
        amount: cleanAmount,
        category,
        note: note.trim() || null,
        job_id: jobId, // ✅ attaches to job if provided
      });

      // If API returns the created expense, prepend. Otherwise reload.
      if (created && typeof created === "object" && "id" in (created as any)) {
        setExpenses((prev) => [created as Expense, ...prev]);
      } else {
        await load();
      }

      setAmount("");
      setNote("");
      setCategory("Other");
    } catch (e: any) {
      console.log("Create expense error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to add expense");
    }
  }

  function onDelete(id: number) {
    Alert.alert("Delete expense?", "This will remove the expense.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExpense(id);
            setExpenses((prev) => prev.filter((x) => x.id !== id));
          } catch (e: any) {
            console.log("Delete expense error:", e?.message || e);
            Alert.alert("Error", e?.message || "Failed to delete expense");
          }
        },
      },
    ]);
  }

  function renderItem({ item }: { item: Expense }) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTop}>
            <Text style={styles.rowAmount}>${Number(item.amount).toFixed(2)}</Text>
            <Text style={styles.rowCategory}>  •  {item.category}</Text>
          </Text>
          {!!item.note && <Text style={styles.rowNote}>{item.note}</Text>}
        </View>

        <Pressable onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading expenses…</Text>
          </View>
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              <>
                <Text style={styles.title}>
                  Expenses{jobId ? ` (Job #${jobId})` : ""}
                </Text>

                {/* Summary */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Summary</Text>
                  <View style={styles.summaryBox}>
                    <Text style={styles.muted}>Total</Text>
                    <Text style={styles.total}>${total.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Add Expense */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Add expense</Text>

                  <Text style={styles.label}>Category</Text>
                  <View style={styles.pills}>
                    {CATEGORIES.map((c) => {
                      const active = c === category;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setCategory(c)}
                          style={[styles.pill, active && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {c}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Amount</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor="#7f8ea3"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />

                  <Text style={styles.label}>Note</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Optional note"
                    placeholderTextColor="#7f8ea3"
                    style={styles.input}
                  />

                  <Pressable onPress={onAdd} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Add</Text>
                  </Pressable>
                </View>

                <Text style={styles.sectionTitle}>List</Text>
              </>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No expenses yet.</Text>
                <Text style={styles.muted}>Add one above to start tracking spending.</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: "#0b1220" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  muted: { color: "#90a4be" },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "white",
    marginBottom: 14,
  },

  listContent: { paddingBottom: 24 },

  card: {
    backgroundColor: "#0f1a2d",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "700", marginBottom: 12 },

  summaryBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 14,
  },
  total: { color: "white", fontSize: 28, fontWeight: "800", marginTop: 6 },

  label: { color: "#b9c7da", fontSize: 13, marginBottom: 6, marginTop: 10 },

  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  pillActive: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "rgba(59,130,246,0.45)",
  },
  pillText: { color: "#b9c7da", fontWeight: "600", fontSize: 12 },
  pillTextActive: { color: "white" },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#2f6fed",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "800", fontSize: 16 },

  sectionTitle: { color: "white", fontSize: 20, fontWeight: "800", marginBottom: 10 },

  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 10,
  },
  rowTop: { color: "white" },
  rowAmount: { color: "white", fontSize: 16, fontWeight: "800" },
  rowCategory: { color: "#9fb3cc", fontSize: 14, fontWeight: "700" },
  rowNote: { color: "#b9c7da", marginTop: 6 },

  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  deleteText: { color: "white", fontWeight: "800" },

  empty: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emptyTitle: { color: "white", fontWeight: "800", fontSize: 16, marginBottom: 6 },
});
