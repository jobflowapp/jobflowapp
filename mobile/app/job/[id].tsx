// mobile/app/job/[id].tsx
import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import Screen from "../../components/Screen";
import { COLORS, SHADOW, SPACING } from "../../lib/ui";
import type { Job, Invoice, Expense, MileageEntry } from "../../lib/types";
import { getJobs, getInvoices, getExpenses, getMileage } from "../../lib/api";

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

export default function JobDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  // ✅ Normalize id param (handles string | string[])
  const jobId = useMemo<number | null>(() => {
    const raw = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<MileageEntry[]>([]);

  const [tab, setTab] = useState<"summary" | "invoices" | "expenses" | "mileage">("summary");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);

    // ✅ If no id, don't call APIs
    if (!jobId) {
      setJob(null);
      setInvoices([]);
      setExpenses([]);
      setMileage([]);
      setLoading(false);
      return;
    }

    try {
      // Jobs endpoint in your app usually returns all jobs,
      // so we fetch all then find the one we need.
      const jobs = await getJobs();
      const found = (Array.isArray(jobs) ? jobs : []).find((j: any) => Number(j?.id) === jobId) ?? null;

      if (!found) {
        setJob(null);
        setInvoices([]);
        setExpenses([]);
        setMileage([]);
        setError("Job not found");
        setLoading(false);
        return;
      }

      setJob(found);

      // These functions in your app accept (jobId | null) and use ?job_id=
      const [inv, exp, mil] = await Promise.all([
        getInvoices(jobId),
        getExpenses(jobId),
        getMileage(jobId),
      ]);

      setInvoices(Array.isArray(inv) ? inv : []);
      setExpenses(Array.isArray(exp) ? exp : []);
      setMileage(Array.isArray(mil) ? mil : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load job");
      setJob(null);
      setInvoices([]);
      setExpenses([]);
      setMileage([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ✅ If jobId missing/invalid, show a clean screen (no alert)
  if (!jobId) {
    return (
      <Screen title="Job not found">
        <View style={styles.center}>
          <Text style={styles.title}>Job not found</Text>
          <Text style={styles.sub}>This job may have been deleted.</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // Optional: show top-level loading state
  if (loading) {
    return (
      <Screen title="Job">
        <View style={styles.center}>
          <Text style={styles.sub}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  // If API says job not found
  if (!job) {
    return (
      <Screen title="Job not found">
        <View style={styles.center}>
          <Text style={styles.title}>Job not found</Text>
          <Text style={styles.sub}>{error || "This job may have been deleted."}</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  
function SegButton({ label, value }: { label: string; value: typeof tab }) {
  const active = tab === value;
  return (
    <TouchableOpacity
      style={[styles.segBtn, active && styles.segBtnActive]}
      onPress={() => setTab(value)}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RowItem({ title, right, onPress }: { title: string; right: string; onPress?: () => void }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.itemRow}>
      <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.itemRight}>{right}</Text>
    </TouchableOpacity>
  );
}

// Totals (adjust field names if yours differ)
  const invoiceTotal = invoices.reduce((sum, i: any) => sum + Number(i?.amount || 0), 0);
  const expenseTotal = expenses.reduce((sum, e: any) => sum + Number(e?.amount || 0), 0);
  const milesTotal = mileage.reduce((sum, m: any) => sum + Number(m?.miles || 0), 0);

  return (
    <Screen title={job?.title || "Job"}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.card}>
          <Text style={styles.h1}>{job?.title || "Job"}</Text>
          {!!job?.customer && <Text style={styles.muted}>{job.customer}</Text>}
          {!!job?.address && <Text style={styles.muted}>{job.address}</Text>}
        </View>

        <View style={styles.row}>
          <View style={[styles.card, styles.half]}>
            <Text style={styles.muted}>Invoices</Text>
            <Text style={styles.big}>{money(invoiceTotal)}</Text>
          </View>

          <View style={[styles.card, styles.half]}>
            <Text style={styles.muted}>Expenses</Text>
            <Text style={styles.big}>{money(expenseTotal)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, styles.half]}>
            <Text style={styles.muted}>Mileage</Text>
            <Text style={styles.big}>{milesTotal.toFixed(1)} mi</Text>
          </View>

          <View style={[styles.card, styles.half]}>
            <Text style={styles.muted}>Profit</Text>
            <Text style={styles.big}>{money(invoiceTotal - expenseTotal)}</Text>
          </View>
        </View>

        
<View style={styles.card}>
  <View style={styles.segment}>
    <SegButton label="Summary" value="summary" />
    <SegButton label="Invoices" value="invoices" />
    <SegButton label="Expenses" value="expenses" />
    <SegButton label="Mileage" value="mileage" />
  </View>

  {tab === "summary" && (
    <View style={{ gap: 12 }}>
      <View style={styles.kpiRow}>
        <View style={[styles.kpi, styles.kpiHalf]}>
          <Text style={styles.muted}>Total invoiced</Text>
          <Text style={styles.big}>{money(invoiceTotal)}</Text>
        </View>
        <View style={[styles.kpi, styles.kpiHalf]}>
          <Text style={styles.muted}>Total expenses</Text>
          <Text style={styles.big}>{money(expenseTotal)}</Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <View style={[styles.kpi, styles.kpiHalf]}>
          <Text style={styles.muted}>Miles</Text>
          <Text style={styles.big}>{milesTotal.toFixed(1)} mi</Text>
        </View>
        <View style={[styles.kpi, styles.kpiHalf]}>
          <Text style={styles.muted}>Profit</Text>
          <Text style={styles.big}>{money(invoiceTotal - expenseTotal)}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: "/(tabs)/invoices", params: { job_id: String(jobId) } } as any)}
        >
          <Text style={styles.primaryBtnText}>Add Invoice</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: "/(tabs)/expenses", params: { job_id: String(jobId) } } as any)}
        >
          <Text style={styles.primaryBtnText}>Add Expense</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: "/(tabs)/mileage", params: { job_id: String(jobId) } } as any)}
        >
          <Text style={styles.primaryBtnText}>Add Mileage</Text>
        </TouchableOpacity>
      </View>
    </View>
  )}

  {tab === "invoices" && (
    <View style={{ gap: 8 }}>
      <Text style={styles.h2}>Invoices</Text>
      {invoices.slice(0, 12).map((inv: any) => (
        <RowItem
          key={String(inv.id)}
          title={inv.note ? String(inv.note) : `Invoice #${inv.id}`}
          right={money(Number(inv.amount || 0))}
          onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: String(inv.id) } } as any)}
        />
      ))}
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => router.push({ pathname: "/(tabs)/invoices", params: { job_id: String(jobId) } } as any)}
      >
        <Text style={styles.secondaryBtnText}>View all / add</Text>
      </TouchableOpacity>
    </View>
  )}

  {tab === "expenses" && (
    <View style={{ gap: 8 }}>
      <Text style={styles.h2}>Expenses</Text>
      {expenses.slice(0, 12).map((e: any) => (
        <RowItem
          key={String(e.id)}
          title={e.note ? String(e.note) : (e.category ? String(e.category) : `Expense #${e.id}`)}
          right={money(Number(e.amount || 0))}
          onPress={() => router.push({ pathname: "/expense/[id]", params: { id: String(e.id) } } as any)}
        />
      ))}
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => router.push({ pathname: "/(tabs)/expenses", params: { job_id: String(jobId) } } as any)}
      >
        <Text style={styles.secondaryBtnText}>View all / add</Text>
      </TouchableOpacity>
    </View>
  )}

  {tab === "mileage" && (
    <View style={{ gap: 8 }}>
      <Text style={styles.h2}>Mileage</Text>
      {mileage.slice(0, 12).map((m: any) => (
        <RowItem
          key={String(m.id)}
          title={m.note ? String(m.note) : `Trip #${m.id}`}
          right={`${Number(m.miles || 0).toFixed(1)} mi`}
          onPress={() => router.push({ pathname: "/mileage/[id]", params: { id: String(m.id) } } as any)}
        />
      ))}
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => router.push({ pathname: "/(tabs)/mileage", params: { job_id: String(jobId) } } as any)}
      >
        <Text style={styles.secondaryBtnText}>View all / add</Text>
      </TouchableOpacity>
    </View>
  )}
</View>
        
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    padding: SPACING.lg,
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.text,
  },
  sub: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOW,
  },
  h1: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  h2: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 8,
  },
  muted: {
    color: COLORS.muted,
    marginTop: 4,
  },
  big: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    color: COLORS.text,
  },
  row: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  half: {
    flex: 1,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: "stretch",
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontWeight: "800",
  },

segment: {
  flexDirection: "row",
  backgroundColor: COLORS.panel,
  borderRadius: 14,
  padding: 4,
  gap: 4,
  marginBottom: 14,
},
segBtn: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 12,
  alignItems: "center",
},
segBtnActive: {
  backgroundColor: COLORS.card,
},
segText: {
  color: COLORS.muted,
  fontWeight: "800",
  fontSize: 12,
},
segTextActive: {
  color: COLORS.text,
},
kpiRow: {
  flexDirection: "row",
  gap: SPACING.md,
},
kpi: {
  backgroundColor: COLORS.panel,
  borderRadius: 16,
  padding: SPACING.lg,
},
kpiHalf: {
  flex: 1,
},
actionsRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 6,
},
itemRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 12,
  borderBottomColor: COLORS.border,
  borderBottomWidth: StyleSheet.hairlineWidth,
},
itemTitle: {
  color: COLORS.text,
  fontWeight: "700",
  flex: 1,
  paddingRight: 12,
},
itemRight: {
  color: COLORS.muted,
  fontWeight: "800",
},

});
