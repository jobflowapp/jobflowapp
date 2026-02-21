// mobile/app/(tabs)/index.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import Screen, { COLORS, RADIUS, SHADOW, SPACING } from "../../components/Screen";
import {
  deleteJob,
  getExpenses,
  getInvoices,
  getJobs,
  getMileage,
  type Job,
} from "../../lib/api";

type JobTotals = { invoiced: number; expenses: number; miles: number };

function money(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toFixed(2)}`;
}

function safeText(v: unknown): string {
  return typeof v === "string" && v.trim().length ? v : "";
}

function sumByJobId<T extends Record<string, any>>(
  rows: T[] | undefined,
  jobIdKey: keyof T,
  valueKey: keyof T,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of rows ?? []) {
    const jobId = Number(r[jobIdKey]);
    if (!Number.isFinite(jobId) || jobId <= 0) continue;
    const val = Number(r[valueKey] ?? 0) || 0;
    out[jobId] = (out[jobId] ?? 0) + val;
  }
  return out;
}

export default function JobsTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalsByJob, setTotalsByJob] = useState<Record<number, JobTotals>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const jobsData = await getJobs();
      const jobsList = Array.isArray(jobsData) ? jobsData : [];
      setJobs(jobsList);

      const [invoices, expenses, mileage] = await Promise.all([
        getInvoices(),
        getExpenses(),
        getMileage(),
      ]);

      const invoicedMap = sumByJobId(invoices as any, "job_id", "amount");
      const expensesMap = sumByJobId(expenses as any, "job_id", "amount");
      const milesMap = sumByJobId(mileage as any, "job_id", "miles");

      const map: Record<number, JobTotals> = {};
      const ids = new Set<number>([
        ...Object.keys(invoicedMap).map(Number),
        ...Object.keys(expensesMap).map(Number),
        ...Object.keys(milesMap).map(Number),
      ]);

      for (const id of ids) {
        map[id] = {
          invoiced: invoicedMap[id] ?? 0,
          expenses: expensesMap[id] ?? 0,
          miles: milesMap[id] ?? 0,
        };
      }

      setTotalsByJob(map);
    } catch (e: any) {
      console.log("JobsTab load error:", e);
      setJobs([]);
      setTotalsByJob({});
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: Job }) => {
      const title = safeText((item as any)?.title) || "Untitled job";
      const status = safeText((item as any)?.status) || "open";

      const t = totalsByJob[(item as any).id] ?? { invoiced: 0, expenses: 0, miles: 0 };
      const profit = t.invoiced - t.expenses;

      return (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/job/[id]", params: { id: String((item as any).id) } } as any)
          }
          style={styles.card}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.sub}>{status}</Text>

              <View style={styles.pillsRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Invoiced</Text>
                  <Text style={styles.pillValue}>{money(t.invoiced)}</Text>
                </View>

                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Expenses</Text>
                  <Text style={styles.pillValue}>{money(t.expenses)}</Text>
                </View>

                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Profit</Text>
                  <Text style={styles.pillValue}>{money(profit)}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                Alert.alert("Delete job?", "This will remove the job.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await deleteJob((item as any).id);
                        await load();
                      } catch (e: any) {
                        Alert.alert("Delete failed", String(e?.message ?? e));
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      );
    },
    [load, totalsByJob],
  );

  const keyExtractor = useCallback((item: Job) => String((item as any).id), []);

  const empty = useMemo(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No jobs yet</Text>
        <Text style={styles.emptySub}>Tap + to create your first job.</Text>
      </View>
    );
  }, [loading]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Jobs</Text>
          <Text style={styles.h2}>Your Jobs</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/job/new" as any)}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading jobs…</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  h1: { fontSize: 42, fontWeight: "800", color: COLORS.text },
  h2: { fontSize: 18, fontWeight: "600", color: COLORS.muted, marginTop: 6 },

  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    ...SHADOW.card,
  },
  addBtnText: { fontSize: 30, fontWeight: "800", color: COLORS.primary, marginTop: -2 },

  listContent: { paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 14 },

  title: { fontSize: 26, fontWeight: "800", color: COLORS.text },
  sub: { fontSize: 16, fontWeight: "600", color: COLORS.muted, marginTop: 6 },

  pillsRow: { flexDirection: "column", gap: 10, marginTop: 14, maxWidth: 240 },
  pill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pillLabel: { color: COLORS.muted, fontWeight: "700" },
  pillValue: { color: COLORS.text, fontWeight: "900" },

  deleteBtn: {
    alignSelf: "center",
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  deleteText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  loadingWrap: { marginTop: 30, alignItems: "center", gap: 10 },
  loadingText: { color: COLORS.muted, fontWeight: "600" },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: COLORS.text, fontWeight: "700" },

  emptyWrap: { marginTop: 40, alignItems: "center", gap: 8 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 20 },
  emptySub: { color: COLORS.muted, fontWeight: "600" },
});