import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getExpenses, getInvoices, getMileage, getJobs } from "../../lib/api";
import type { Expense, Invoice, MileageEntry, Job } from "../../lib/types";

const IRS_RATE = 0.67;

function startOfYearISO() {
  const d = new Date();
  const y = d.getFullYear();
  return new Date(y, 0, 1);
}

function parseDate(d?: string | null) {
  if (!d) return new Date(0);
  const x = new Date(d);
  return isNaN(x.getTime()) ? new Date(0) : x;
}

export default function ExploreTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [j, i, e, m] = await Promise.all([getJobs(), getInvoices(null), getExpenses(null), getMileage(null)]);
      setJobs(Array.isArray(j) ? j : []);
      setInvoices(Array.isArray(i) ? i : []);
      setExpenses(Array.isArray(e) ? e : []);
      setMileage(Array.isArray(m) ? m : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ytdStart = useMemo(() => startOfYearISO(), []);

  const ytd = useMemo(() => {
    const ytdInvoices = invoices.filter((i) => parseDate(i.created_at) >= ytdStart);
    const ytdExpenses = expenses.filter((e) => parseDate(e.created_at) >= ytdStart);
    const ytdMileage = mileage.filter((m) => parseDate(m.created_at) >= ytdStart);

    const revenue = ytdInvoices
      .filter((i) => String(i.status ?? "").toLowerCase() === "paid")
      .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

    const expenseTotal = ytdExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const milesTotal = ytdMileage.reduce((sum, m) => sum + Number(m.miles ?? 0), 0);

    const mileageDeduction = milesTotal * IRS_RATE;
    const totalDeduction = expenseTotal + mileageDeduction;

    const profit = revenue - expenseTotal;

    return { revenue, expenseTotal, milesTotal, mileageDeduction, totalDeduction, profit };
  }, [invoices, expenses, mileage, ytdStart]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.title}>JobFlow 🚀</Text>
        <Text style={styles.sub}>Track jobs, expenses, travel, and profit.</Text>

        <TouchableOpacity style={styles.button} onPress={load} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Loading..." : "Refresh Everything"}</Text>
        </TouchableOpacity>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Year to Date</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Jobs</Text>
            <Text style={styles.value}>{jobs.length}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Revenue (paid invoices)</Text>
            <Text style={styles.value}>${ytd.revenue.toFixed(2)}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Expenses</Text>
            <Text style={styles.value}>${ytd.expenseTotal.toFixed(2)}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Miles</Text>
            <Text style={styles.value}>{ytd.milesTotal.toFixed(1)}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Mileage Deduction</Text>
            <Text style={styles.value}>${ytd.mileageDeduction.toFixed(2)}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Total Deduction</Text>
            <Text style={styles.value}>${ytd.totalDeduction.toFixed(2)}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Profit (rev - expenses)</Text>
            <Text style={styles.value}>${ytd.profit.toFixed(2)}</Text>
          </View>

          <Text style={styles.hint}>IRS_RATE = {IRS_RATE}. Change anytime.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220", padding: 16 },
  title: { color: "white", fontSize: 44, fontWeight: "900" },
  sub: { color: "#9ca3af", marginTop: 6, marginBottom: 14 },
  error: { color: "#ef4444", marginTop: 10, fontWeight: "800" },

  button: { backgroundColor: "#2563eb", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "900", fontSize: 16 },

  panel: { backgroundColor: "#111827", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#1f2937", marginTop: 14 },
  panelTitle: { color: "white", fontSize: 20, fontWeight: "800", marginBottom: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  label: { color: "#9ca3af", fontWeight: "800", flex: 1, paddingRight: 10 },
  value: { color: "white", fontWeight: "900", fontSize: 18 },
  hint: { color: "#6b7280", marginTop: 12, fontWeight: "700" },
});
