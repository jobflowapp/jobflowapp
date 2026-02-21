// mobile/app/invoice/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen, { COLORS, RADIUS, SHADOW, SPACING } from "../../components/Screen";
import {
  deleteInvoice,
  getInvoices,
  updateInvoice,
  type Invoice,
} from "../../lib/api";

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function moneyToNumber(s: string): number | null {
  const cleaned = s.replace(/[^\d.-]/g, "");
  if (!cleaned.trim()) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const STATUSES = ["unpaid", "sent", "paid"] as const;
type Status = (typeof STATUSES)[number];

export default function EditInvoiceScreen() {
  const params = useLocalSearchParams();
  const invoiceId = useMemo(() => toNum(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("unpaid");

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);

    try {
      const list = await getInvoices();
      const found = (list ?? []).find((x: any) => Number(x.id) === invoiceId) ?? null;

      if (!found) {
        Alert.alert("Not found", "Invoice not found.");
        router.back();
        return;
      }

      setInvoice(found);
      setAmount(String(found.amount ?? ""));
      setNote(String(found.note ?? ""));
      setStatus((String(found.status ?? "unpaid").toLowerCase() as Status) ?? "unpaid");
    } catch (e: any) {
      console.log("Invoice load error:", e);
      Alert.alert("Load failed", String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!invoiceId || !invoice) return;

    const n = moneyToNumber(amount);
    if (n == null) {
      Alert.alert("Invalid amount", "Please enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      // Fix: API expects job_id: number | undefined (not null)
      const job_id = (invoice as any).job_id ?? undefined;

      await updateInvoice(invoiceId, {
        job_id,
        amount: n,
        status,
        note: note.trim() ? note.trim() : null,
      });

      Alert.alert("Saved", "Invoice updated.");
      await load();
    } catch (e: any) {
      console.log("Invoice save error:", e);
      Alert.alert("Save failed", String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }, [amount, invoice, invoiceId, load, note, status]);

  const onDelete = useCallback(async () => {
    if (!invoiceId) return;

    Alert.alert("Delete invoice?", "This will remove the invoice.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await deleteInvoice(invoiceId);
            Alert.alert("Deleted", "Invoice removed.");
            router.back();
          } catch (e: any) {
            console.log("Invoice delete error:", e);
            Alert.alert("Delete failed", String(e?.message ?? e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [invoiceId]);

  if (!invoiceId) {
    return (
      <Screen title="Invoice" scroll>
        <Text style={{ color: COLORS.muted, fontWeight: "700" }}>Missing invoice id.</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Edit Invoice" loading={loading} scroll padding={SPACING.md}>
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

        <Text style={[styles.label, { marginTop: 12 }]}>Status</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const active = s === status;
            return (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[styles.statusPill, active && styles.statusPillActive]}
              >
                <Text style={[styles.statusText, active && styles.statusTextActive]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional note"
          placeholderTextColor={COLORS.muted}
          style={styles.input}
        />

        <View style={{ height: 16 }} />

        <Pressable onPress={onSave} style={[styles.primaryBtn, saving && { opacity: 0.7 }]}>
          <Text style={styles.primaryText}>{saving ? "Saving..." : "Save"}</Text>
        </Pressable>

        <Pressable onPress={onDelete} style={[styles.deleteBtn, saving && { opacity: 0.7 }]}>
          <Text style={styles.deleteText}>Delete invoice</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOW.card,
  },
  label: { color: COLORS.muted, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statusPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusPillActive: { backgroundColor: COLORS.primary },
  statusText: { color: COLORS.text, fontWeight: "900" },
  statusTextActive: { color: "#fff" },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  deleteBtn: {
    marginTop: 12,
    backgroundColor: COLORS.danger,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteText: { color: "#fff", fontWeight: "900" },
});