// mobile/app/(tabs)/mileage.tsx
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
import { createMileage, deleteMileage, getMileage, type MileageEntry } from "../../lib/api";

// 2024 IRS standard mileage rate (business): $0.67 / mile
const IRS_MILE_RATE = 0.67;

function toJobId(val: unknown): number | null {
  if (val == null) return null;
  const raw = Array.isArray(val) ? val[0] : val;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

export default function MileageScreen() {
  const params = useLocalSearchParams();
  const jobId = useMemo(() => toJobId(params?.job_id), [params?.job_id]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [mileage, setMileageList] = useState<MileageEntry[]>([]);

  // form
  const [miles, setMiles] = useState("");
  const [note, setNote] = useState("");

  const milesTotal = useMemo(() => {
    return mileage.reduce((sum, m) => sum + (Number(m.miles) || 0), 0);
  }, [mileage]);

  const estDeduction = useMemo(() => milesTotal * IRS_MILE_RATE, [milesTotal]);

  async function load() {
    try {
      const data = await getMileage(jobId); // null = all
      setMileageList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log("Mileage load error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to load mileage");
      setMileageList([]);
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
    const cleanMiles = Number(String(miles).replace(/[^0-9.]/g, ""));
    if (!cleanMiles || cleanMiles <= 0) {
      Alert.alert("Missing miles", "Enter a valid miles amount.");
      return;
    }

    try {
      const created = await createMileage({
        miles: cleanMiles,
        note: note.trim() || null,
        job_id: jobId, // ✅ attaches to job if provided
      });

      if (created && typeof created === "object" && "id" in (created as any)) {
        setMileageList((prev) => [created as MileageEntry, ...prev]);
      } else {
        await load();
      }

      setMiles("");
      setNote("");
    } catch (e: any) {
      console.log("Create mileage error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to add mileage");
    }
  }

  function onDelete(id: number) {
    Alert.alert("Delete trip?", "This will remove the mileage entry.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMileage(id);
            setMileageList((prev) => prev.filter((x) => x.id !== id));
          } catch (e: any) {
            console.log("Delete mileage error:", e?.message || e);
            Alert.alert("Error", e?.message || "Failed to delete mileage");
          }
        },
      },
    ]);
  }

  function renderItem({ item }: { item: MileageEntry }) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTop}>
            <Text style={styles.rowMiles}>{Number(item.miles).toFixed(1)} mi</Text>
            <Text style={styles.rowDeduction}>
              {"  "}• est {money((Number(item.miles) || 0) * IRS_MILE_RATE)}
            </Text>
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
            <Text style={styles.muted}>Loading mileage…</Text>
          </View>
        ) : (
          <FlatList
            data={mileage}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              <>
                <Text style={styles.title}>
                  Mileage{jobId ? ` (Job #${jobId})` : ""}
                </Text>

                {/* Summary */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Summary</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.muted}>Total miles</Text>
                    <Text style={styles.big}>{milesTotal.toFixed(1)} mi</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.muted}>Est. deduction ({money(IRS_MILE_RATE)}/mi)</Text>
                    <Text style={styles.big}>{money(estDeduction)}</Text>
                  </View>
                </View>

                {/* Add Mileage */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Add trip</Text>

                  <Text style={styles.label}>Miles</Text>
                  <TextInput
                    value={miles}
                    onChangeText={setMiles}
                    placeholder="0.0"
                    placeholderTextColor="#7f8ea3"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />

                  <Text style={styles.label}>Note</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Optional note (client, address, etc.)"
                    placeholderTextColor="#7f8ea3"
                    style={styles.input}
                  />

                  <Pressable onPress={onAdd} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Add</Text>
                  </Pressable>
                </View>

                <Text style={styles.sectionTitle}>Trips</Text>
              </>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No mileage yet.</Text>
                <Text style={styles.muted}>Add a trip above to start tracking deduction.</Text>
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
  big: { color: "white", fontSize: 20, fontWeight: "900" },

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
  rowMiles: { color: "white", fontSize: 16, fontWeight: "900" },
  rowDeduction: { color: "#9fb3cc", fontSize: 14, fontWeight: "800" },
  rowNote: { color: "#b9c7da", marginTop: 6 },

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
