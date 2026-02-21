// mobile/app/(tabs)/reports.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import Screen, { COLORS, RADIUS, SHADOW, SPACING } from "../../components/Screen";
import { getExpenses, getInvoices, getMileage } from "../../lib/api";

type Invoice = { id: number; job_id?: number | null; amount?: number | null; status?: string | null; created_at?: string };
type Expense = { id: number; job_id?: number | null; amount?: number | null; category?: string | null; created_at?: string };
type Mileage = { id: number; job_id?: number | null; miles?: number | null; created_at?: string };

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

function toYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isFinite(d.getTime()) ? d.getFullYear() : null;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function shareCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const header = keys.map(csvEscape).join(",");
  const body = rows.map((r) => keys.map((k) => csvEscape((r as any)[k])).join(",")).join("\n");
  const csv = [header, body].filter(Boolean).join("\n");

  // Avoid TS type mismatches across Expo SDK versions by using "as any".
  const fs: any = FileSystem as any;
  const baseDir: string | null = fs.documentDirectory ?? fs.cacheDirectory ?? null;

  if (!baseDir) {
    Alert.alert("Export failed", "No document directory available.");
    return;
  }

  const uri = `${baseDir}${filename}`;

  await fs.writeAsStringAsync(uri, csv, {
    encoding: fs.EncodingType?.UTF8 ?? "utf8",
  });

  const canShare = await (Sharing as any).isAvailableAsync?.();
  if (!canShare) {
    Alert.alert("Sharing not available", "This device does not support file sharing.");
    return;
  }

  await (Sharing as any).shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: "Export CSV",
    UTI: "public.comma-separated-values-text",
  });
}

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<Mileage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, exp, mil] = await Promise.all([getInvoices(), getExpenses(), getMileage()]);
      setInvoices((inv ?? []) as any);
      setExpenses((exp ?? []) as any);
      setMileage((mil ?? []) as any);
    } catch (e: any) {
      console.log("Reports load error:", e);
      Alert.alert("Reports failed to load", String(e?.message ?? e));
      setInvoices([]);
      setExpenses([]);
      setMileage([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const years = useMemo(() => {
    const y = new Set<number>();
    for (const r of invoices) {
      const yr = toYear(r.created_at);
      if (yr) y.add(yr);
    }
    for (const r of expenses) {
      const yr = toYear(r.created_at);
      if (yr) y.add(yr);
    }
    for (const r of mileage) {
      const yr = toYear(r.created_at);
      if (yr) y.add(yr);
    }
    const arr = Array.from(y).sort((a, b) => b - a);
    return arr.length ? arr : [new Date().getFullYear()];
  }, [invoices, expenses, mileage]);

  const filtered = useMemo(() => {
    const inv = invoices.filter((r) => toYear(r.created_at) === year);
    const exp = expenses.filter((r) => toYear(r.created_at) === year);
    const mil = mileage.filter((r) => toYear(r.created_at) === year);
    return { inv, exp, mil };
  }, [invoices, expenses, mileage, year]);

  const totals = useMemo(() => {
    const invoiced = filtered.inv.reduce((s, r) => s + (Number(r.amount ?? 0) || 0), 0);
    const paid = filtered.inv
      .filter((r) => String(r.status ?? "").toLowerCase() === "paid")
      .reduce((s, r) => s + (Number(r.amount ?? 0) || 0), 0);
    const outstanding = invoiced - paid;
    const exp = filtered.exp.reduce((s, r) => s + (Number(r.amount ?? 0) || 0), 0);
    const miles = filtered.mil.reduce((s, r) => s + (Number(r.miles ?? 0) || 0), 0);
    const net = paid - exp;
    return { invoiced, paid, outstanding, exp, miles, net };
  }, [filtered]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered.exp) {
      const k = String(r.category ?? "other").toLowerCase();
      map.set(k, (map.get(k) ?? 0) + (Number(r.amount ?? 0) || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered.exp]);

  if (loading) {
    return (
      <Screen title="Reports" scroll>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.muted, { marginTop: 12 }]}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Reports" scroll>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Tax Summary</Text>
        <Text style={styles.muted}>Select a year and export CSV anytime.</Text>

        <View style={styles.yearRow}>
          {years.map((y) => {
            const active = y === year;
            return (
              <Pressable
                key={String(y)}
                onPress={() => setYear(y)}
                style={[styles.yearPill, active && styles.yearPillActive]}
              >
                <Text style={[styles.yearText, active && styles.yearTextActive]}>{y}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.grid}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Income (invoiced)</Text>
            <Text style={styles.kpiValue}>{money(totals.invoiced)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Paid</Text>
            <Text style={styles.kpiValue}>{money(totals.paid)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Outstanding</Text>
            <Text style={styles.kpiValue}>{money(totals.outstanding)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Expenses</Text>
            <Text style={styles.kpiValue}>{money(totals.exp)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Miles</Text>
            <Text style={styles.kpiValue}>{totals.miles.toFixed(1)} mi</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Net (paid - expenses)</Text>
            <Text style={styles.kpiValue}>{money(totals.net)}</Text>
          </View>
        </View>

        <View style={[styles.card, { marginTop: SPACING.lg }]}>
          <Text style={styles.cardTitle}>Expenses by category</Text>
          {expensesByCategory.length ? (
            expensesByCategory.map(([cat, amt]) => (
              <View key={cat} style={styles.rowBetween}>
                <Text style={styles.muted}>{cat}</Text>
                <Text style={styles.value}>{money(amt)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No expenses for this year.</Text>
          )}
        </View>

        <View style={styles.exportRow}>
          <Pressable
            style={styles.exportBtn}
            onPress={async () =>
              shareCsv(
                `jobflow_invoices_${year}.csv`,
                filtered.inv.map((r) => ({
                  id: r.id,
                  job_id: r.job_id ?? "",
                  amount: r.amount ?? 0,
                  status: r.status ?? "",
                  created_at: r.created_at ?? "",
                })),
              )
            }
          >
            <Text style={styles.exportText}>Export Invoices CSV</Text>
          </Pressable>

          <Pressable
            style={styles.exportBtn}
            onPress={async () =>
              shareCsv(
                `jobflow_expenses_${year}.csv`,
                filtered.exp.map((r) => ({
                  id: r.id,
                  job_id: r.job_id ?? "",
                  amount: r.amount ?? 0,
                  category: r.category ?? "",
                  created_at: r.created_at ?? "",
                })),
              )
            }
          >
            <Text style={styles.exportText}>Export Expenses CSV</Text>
          </Pressable>

          <Pressable
            style={styles.exportBtn}
            onPress={async () =>
              shareCsv(
                `jobflow_mileage_${year}.csv`,
                filtered.mil.map((r) => ({
                  id: r.id,
                  job_id: r.job_id ?? "",
                  miles: r.miles ?? 0,
                  created_at: r.created_at ?? "",
                })),
              )
            }
          >
            <Text style={styles.exportText}>Export Mileage CSV</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 60 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  h1: { fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 6 },
  muted: { color: COLORS.muted, fontWeight: "700", marginTop: 6 },

  yearRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: SPACING.lg },
  yearPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  yearPillActive: { backgroundColor: COLORS.primary },
  yearText: { color: COLORS.text, fontWeight: "900" },
  yearTextActive: { color: "#fff" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: SPACING.lg },
  kpi: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  kpiLabel: { color: COLORS.muted, fontWeight: "800" },
  kpiValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 8 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16, marginBottom: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  value: { color: COLORS.text, fontWeight: "900" },

  exportRow: { gap: 12, marginTop: SPACING.xl },
  exportBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  exportText: { color: "#fff", fontWeight: "900" },
});