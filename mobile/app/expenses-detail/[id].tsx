import React, { useEffect, useMemo, useState } from "react"
import { Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import Screen from "../../components/Screen"
import { COLORS, SPACING, RADIUS, SHADOW } from "../../lib/ui"
import { getExpense, updateExpense, deleteExpense } from "../../lib/api"

export default function EditExpenseScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()

  const expenseId = useMemo(() => Number(id), [id])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [amount, setAmount] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [jobId, setJobId] = useState<string>("")

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        const e = await getExpense(expenseId)
        if (!alive) return

        setAmount(String(e?.amount ?? ""))
        setNote(String(e?.note ?? ""))
        setJobId(e?.job_id != null ? String(e.job_id) : "")
      } catch (err: any) {
        Alert.alert("Error", err?.message ?? "Failed to load expense")
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [expenseId])

  async function onSave() {
    try {
      setSaving(true)

      const amt = Number(amount)
      if (!Number.isFinite(amt)) {
        Alert.alert("Missing amount", "Enter a valid amount (example: 25 or 25.50).")
        return
      }

      await updateExpense(expenseId, {
        amount: amt,
        note: note.trim() ? note.trim() : null,
        job_id: jobId.trim() ? Number(jobId) : null,
      })

      Alert.alert("Saved", "Expense updated.")
      router.back()
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save expense")
    } finally {
      setSaving(false)
    }
  }

  function onDelete() {
    Alert.alert("Delete expense?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true)
            await deleteExpense(expenseId)
            Alert.alert("Deleted", "Expense removed.")
            router.back()
          } catch (err: any) {
            Alert.alert("Error", err?.message ?? "Failed to delete expense")
          } finally {
            setSaving(false)
          }
        },
      },
    ])
  }

  return (
    <Screen title="Edit Expense" loading={loading}>
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

        <Text style={[styles.label, { marginTop: SPACING.md }]}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional note"
          placeholderTextColor={COLORS.muted}
          style={[styles.input, styles.multiline]}
          multiline
        />

        <Text style={[styles.label, { marginTop: SPACING.md }]}>Job ID (optional)</Text>
        <TextInput
          value={jobId}
          onChangeText={setJobId}
          placeholder="Leave blank for none"
          placeholderTextColor={COLORS.muted}
          keyboardType="number-pad"
          style={styles.input}
        />

        <View style={styles.row}>
          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDelete} disabled={saving} style={styles.dangerBtn} activeOpacity={0.8}>
            <Text style={styles.dangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW,
  },
  label: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: SPACING.md,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  dangerBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dangerText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
})
