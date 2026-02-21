import React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { COLORS, SPACING } from "../../lib/ui"

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

export function EmptyState({
  title = "Nothing here yet.",
  subtitle,
}: {
  title?: string
  subtitle?: string
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.text}>{subtitle}</Text> : null}
    </View>
  )
}

export function ErrorState({
  message = "Something went wrong.",
}: {
  message?: string
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.errorTitle}>Error</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    padding: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  errorTitle: {
    color: COLORS.danger,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  text: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
})
