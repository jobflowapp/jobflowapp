// mobile/app/job/new.tsx
import React, { useState } from "react"
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { useRouter } from "expo-router"

import Screen from "../../components/Screen"
import { COLORS, SHADOW, SPACING } from "../../lib/ui"
import { createJob } from "../../lib/api"
import type { Job } from "../../lib/types"

function safeText(e: any) {
  if (!e) return ""
  if (typeof e === "string") return e
  if (typeof e?.message === "string") return e.message
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

export default function NewJobScreen() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

 const onSave = async () => {
  if (!title.trim()) {
    Alert.alert("Error", "Job title is required.")
    return
  }

  setSaving(true)

  try {
    const job = await createJob({
  title: title.trim(),
  client_name: null,
  status: "active",   // 👈 REQUIRED
  start_date: null,
  end_date: null,
})


    // Go to the job details screen
    router.replace(`/job/${job.id}`)
  } catch (e: any) {
    console.log("Create job error:", e)

    const msg =
      e?.message ||
      e?.detail ||
      (typeof e === "string" ? e : null) ||
      (typeof e?.toString === "function" ? e.toString() : null) ||
      "Failed to create job."

    Alert.alert("Error", msg)
  } finally {
    setSaving(false)
  }
}

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Create New Job</Text>

        <Text style={styles.label}>Job Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Cable install"
          placeholderTextColor={COLORS.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes, address, etc. (optional)"
          placeholderTextColor={COLORS.muted}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
        >
          <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save Job"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOW.md,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
  },
  label: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  input: {
    backgroundColor: COLORS.input,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontWeight: "700",
  },
})
