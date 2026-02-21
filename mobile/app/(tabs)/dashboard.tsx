// mobile/app/(tabs)/dashboard.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/Screen";

// ✅ Make sure these exist in mobile/lib/api.ts
import {
  getJobs,
  getInvoices,
  getExpenses,
  getMileage,
  type Job,
  type Invoice,
  type Expense,
  type MileageEntry,
} from "../../lib/api";

import { getToken } from "../../lib/auth";

// 2024 IRS standard mileage rate (business): $0.67 / mile
const IRS_MILE_RATE = 0.67;

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

export default function DashboardScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<MileageEntry[]>([]);

  const load = useCallback(async () => {
    const token = await getToken();
if (!token) {
  setLoading(false);
  router.replace("/(auth)/login");
  return;
}

    try {
      const [j, inv, exp, mil] = await Promise.all([
        getJobs(),
        getInvoices(null), // ✅ all invoices
        getExpenses(null), // ✅ all expenses
        getMileage(null),  // ✅ all mileage
      ]);

      setJobs(Array.isArray(j) ? j : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      setExpenses(Array.isArray(exp) ? exp : []);
      setMileage(Array.isArray(mil) ? mil : []);
    } catch (e: any) {
      console.log("Dashboard load error:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // ===== Totals =====
  const ytdIncome = useMemo(
    () => invoices.reduce((sum, inv) => sum + (Number((inv as any).amount) || 0), 0),
    [invoices]
  );

  const ytdExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number((e as any).amount) || 0), 0),
    [expenses]
  );

  const ytdMiles = useMemo(
    () => mileage.reduce((sum, m) => sum + (Number((m as any).miles) || 0), 0),
    [mileage]
  );

  const ytdMileageDeduction = useMemo(() => ytdMiles * IRS_MILE_RATE, [ytdMiles]);

  const ytdProfit = useMemo(
    () => ytdIncome - ytdExpenses - ytdMileageDeduction,
    [ytdIncome, ytdExpenses, ytdMileageDeduction]
  );

  const paidIncome = useMemo(() => {
    return invoices
      .filter((i) => String((i as any).status || "").toLowerCase() === "paid")
      .reduce((sum, inv) => sum + (Number((inv as any).amount) || 0), 0);
  }, [invoices]);

  const outstandingIncome = useMemo(() => ytdIncome - paidIncome, [ytdIncome, paidIncome]);

  if (loading) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading dashboard…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      {/* Use ScrollView INSIDE Screen(noScroll) so there’s only ONE scroller */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subTitle}>Year to date</Text>

        {/* Big Profit Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>YTD Profit</Text>
          <Text style={styles.heroValue}>{money(ytdProfit)}</Text>

          <View style={styles.heroRow}>
            <View style={styles.heroMini}>
              <Text style={styles.muted}>Income</Text>
              <Text style={styles.miniValue}>{money(ytdIncome)}</Text>
            </View>
            <View style={styles.heroMini}>
              <Text style={styles.muted}>Expenses</Text>
              <Text style={styles.miniValue}>{money(ytdExpenses)}</Text>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroMini}>
              <Text style={styles.muted}>Miles</Text>
              <Text style={styles.miniValue}>{ytdMiles.toFixed(1)} mi</Text>
            </View>
            <View style={styles.heroMini}>
              <Text style={styles.muted}>Mileage Deduction</Text>
              <Text style={styles.miniValue}>{money(ytdMileageDeduction)}</Text>
            </View>
          </View>

          <Text style={styles.rateNote}>IRS rate: {money(IRS_MILE_RATE)}/mi</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick stats</Text>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Jobs</Text>
            <Text style={styles.statValue}>{jobs.length}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Paid income</Text>
            <Text style={styles.statValue}>{money(paidIncome)}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={styles.statValue}>{money(outstandingIncome)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>

          <View style={{ gap: 10 }}>
            <Pressable style={[styles.btn, styles.primary]} onPress={() => router.push("/(tabs)")}>
              <Text style={styles.btnText}>Go to Jobs</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.secondary]} onPress={() => router.push("/(tabs)/invoices")}>
              <Text style={styles.btnText}>All Invoices</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.secondary]} onPress={() => router.push("/(tabs)/expenses")}>
              <Text style={styles.btnText}>All Expenses</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.secondary]} onPress={() => router.push("/(tabs)/mileage")}>
              <Text style={styles.btnText}>All Mileage</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },

  muted: { color: "#90a4be" },

  title: { color: "white", fontSize: 30, fontWeight: "900" },
  subTitle: { color: "#b9c7da", marginTop: 6, marginBottom: 14, fontWeight: "700" },

  heroCard: {
    backgroundColor: "#0f1a2d",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },
  heroLabel: { color: "#b9c7da", fontWeight: "800" },
  heroValue: { color: "white", fontSize: 38, fontWeight: "900", marginTop: 6 },

  heroRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  heroMini: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  miniValue: { color: "white", fontWeight: "900", marginTop: 6, fontSize: 16 },

  rateNote: { marginTop: 12, color: "#9fb3cc", fontWeight: "700" },

  card: {
    backgroundColor: "#0f1a2d",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "800", marginBottom: 12 },

  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  statLabel: { color: "#b9c7da", fontWeight: "800" },
  statValue: { color: "white", fontWeight: "900" },

  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  primary: { backgroundColor: "#2f6fed", borderColor: "rgba(255,255,255,0.10)" },
  secondary: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" },
  btnText: { color: "white", fontWeight: "900" },
});
