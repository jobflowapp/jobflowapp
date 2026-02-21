// mobile/app/(tabs)/invoices.tsx
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
import { createInvoice, deleteInvoice, getInvoices, updateInvoice, type Invoice } from "../../lib/api";

const STATUSES = ["unpaid", "paid", "sent"] as const;

function toJobId(val: unknown): number | null {
  if (val == null) return null;
  const raw = Array.isArray(val) ? val[0] : val;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function InvoicesScreen() {
  const params = useLocalSearchParams();
  const jobId = useMemo(() => toJobId(params?.job_id), [params?.job_id]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // form
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("unpaid");

  const total = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [invoices]);

  const totalPaid = useMemo(() => {
    return invoices
      .filter((i) => String(i.status || "").toLowerCase() === "paid")
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [invoices]);

  async function load() {
    try {
      const data = await getInvoices(jobId); // null = all
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log("Invoices load error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to load invoices");
      setInvoices([]);
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
      Alert.alert("Missing amount", "Enter a valid invoice amount.");
      return;
    }

    try {
      const created = await createInvoice({
        amount: cleanAmount,
        status,
        note: note.trim() || null,
        job_id: jobId, // ✅ attaches to job if provided
      });

      if (created && typeof created === "object" && "id" in (created as any)) {
        setInvoices((prev) => [created as Invoice, ...prev]);
      } else {
        await load();
      }

      setAmount("");
      setNote("");
      setStatus("unpaid");
    } catch (e: any) {
      console.log("Create invoice error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to add invoice");
    }
  }

  function onDelete(id: number) {
    Alert.alert("Delete invoice?", "This will remove the invoice.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteInvoice(id);
            setInvoices((prev) => prev.filter((x) => x.id !== id));
          } catch (e: any) {
            console.log("Delete invoice error:", e?.message || e);
            Alert.alert("Error", e?.message || "Failed to delete invoice");
          }
        },
      },
    ]);
  }

  
async function onToggleStatus(item: Invoice) {
  const cur = String(item.status || "unpaid").toLowerCase();
  const next = cur === "unpaid" ? "sent" : cur === "sent" ? "paid" : "unpaid";

  try {
    const updated = await updateInvoice(item.id, { status: next });
    setInvoices((prev) => prev.map((x) => (x.id === item.id ? (updated as Invoice) : x)));
  } catch (e: any) {
    console.log("Update invoice error:", e?.message || e);
    Alert.alert("Error", e?.message || "Failed to update invoice");
  }
}

function StatusPill({ value, onPress }: { value: string | null | undefined; onPress?: () => void }) {
    const v = String(value || "unpaid").toLowerCase();
    const isPaid = v === "paid";
    const isSent = v === "sent";

    return (
      <Pressable onPress={onPress} style={[
          styles.statusPill,
          isPaid && styles.statusPaid,
          isSent && styles.statusSent,
        ]}
      >
        <Text style={styles.statusText}>{v.toUpperCase()}</Text>
      </Pressable>
    );
  }

  function renderItem({ item }: { item: Invoice }) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTop}>
            <Text style={styles.rowAmount}>${Number(item.amount).toFixed(2)}</Text>
          </Text>

          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <StatusPill value={item.status} onPress={() => onToggleStatus(item)} />
            {!!item.note && <Text style={styles.rowNote} numberOfLines={1}>{item.note}</Text>}
          </View>
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
            <Text style={styles.muted}>Loading invoices…</Text>
          </View>
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              <>
                <Text style={styles.title}>
                  Invoices{jobId ? ` (Job #${jobId})` : ""}
                </Text>

                {/* Summary */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Summary</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.muted}>Total</Text>
                    <Text style={styles.total}>${total.toFixed(2)}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.muted}>Paid</Text>
                    <Text style={styles.paid}>${totalPaid.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Add Invoice */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Add invoice</Text>

                  <Text style={styles.label}>Status</Text>
                  <View style={styles.pills}>
                    {STATUSES.map((s) => {
                      const active = s === status;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => setStatus(s)}
                          style={[styles.pill, active && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {s.toUpperCase()}
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
                <Text style={styles.emptyTitle}>No invoices yet.</Text>
                <Text style={styles.muted}>Add one above to start tracking income.</Text>
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

  title: { fontSize: 28, fontWeight: "800", color: "white", marginBottom: 14 },
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

  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  total: { color: "white", fontSize: 22, fontWeight: "900" },
  paid: { color: "white", fontSize: 18, fontWeight: "900" },

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
  pillText: { color: "#b9c7da", fontWeight: "700", fontSize: 12 },
  pillTextActive: { color: "white" },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#2f6fed",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "900", fontSize: 16 },

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
  rowAmount: { color: "white", fontSize: 16, fontWeight: "900" },
  rowNote: { color: "#b9c7da", flexShrink: 1 },

  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  statusPaid: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.35)",
  },
  statusSent: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.35)",
  },
  statusText: { color: "white", fontWeight: "900", fontSize: 11 },

  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  deleteText: { color: "white", fontWeight: "900" },

  empty: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emptyTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 6 },
});
