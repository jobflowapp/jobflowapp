import React, { useEffect, useMemo, useState } from "react"
import { Alert, Text, TextInput, TouchableOpacity, View, StyleSheet, ScrollView } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import Screen from "../../components/Screen"
import { COLORS, SPACING, RADIUS, SHADOW } from "../../lib/ui"
import { getMileageEntry, updateMileage, deleteMileage } from "../../lib/api"

export default function EditMileageScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const mileageId = useMemo(() => Number(id), [id])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [miles, setMiles] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [jobId, setJobId] = useState<string>("")

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        const m = await getMileageEntry(mileageId)

        if (!alive) return

        // API types: miles, note, job_id
        setMiles(String((m as any).miles ?? ""))
        setNote(String((m as any).note ?? ""))
        setJobId((m as any).job_id != null ? String((m as any).job_id) : "")
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load mileage entry")
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [mileageId])

  async function onSave() {
    try {
      setSaving(true)

      const milesNum = Number(miles)
      if (!Number.isFinite(milesNum) || milesNum <= 0) {
        Alert.alert("Invalid miles", "Enter a miles number greater than 0.")
        return
      }

      const jobIdNum = jobId.trim() === "" ? null : Number(jobId)
      if (jobId.trim() !== "" && (!Number.isFinite(jobIdNum) || (jobIdNum as number) <= 0)) {
        Alert.alert("Invalid Job ID", "Job ID must be a valid number (or leave it blank).")
        return
      }

      await updateMileage(mileageId, {
        miles: milesNum,
        note: note.trim() === "" ? null : note.trim(),
        job_id: jobIdNum,
      })

      Alert.alert("Saved", "Mileage entry updated.")
      router.back()
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save mileage entry")
    } finally {
      setSaving(false)
    }
  }

  function onDelete() {
    Alert.alert("Delete mileage?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true)
            await deleteMileage(mileageId)
            Alert.alert("Deleted", "Mileage entry removed.")
            router.back()
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to delete mileage entry")
          } finally {
            setSaving(false)
          }
        },
      },
    ])
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Mileage</Text>
        <Text style={styles.subTitle}>ID: {Number.isFinite(mileageId) ? mileageId : "—"}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Miles</Text>
          <TextInput
            value={miles}
            onChangeText={setMiles}
            placeholder="0"
            placeholderTextColor={COLORS.muted}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={COLORS.muted}
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Job ID (optional)</Text>
          <TextInput
            value={jobId}
            onChangeText={setJobId}
            placeholder="Leave blank for none"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
            style={styles.input}
          />

          <TouchableOpacity
            onPress={onSave}
            disabled={loading || saving}
            style={[styles.primaryBtn, (loading || saving) && { opacity: 0.6 }]}
          >
            <Text style={styles.primaryText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDelete}
            disabled={loading || saving}
            style={[styles.dangerBtn, (loading || saving) && { opacity: 0.6 }]}
          >
            <Text style={styles.dangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    paddingBottom: 40,
    backgroundColor: COLORS.bg,
    flexGrow: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  subTitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW, // ✅ not SHADOW.md
  },
  label: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontWeight: "800",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: {
    color: "#0B1220",
    fontWeight: "900",
    fontSize: 16,
  },
  dangerBtn: {
    marginTop: 12,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
})
