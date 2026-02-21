// mobile/components/Screen.tsx
import React from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

/**
 * Design tokens used across screens.
 * Exported here to keep existing imports working.
 */
export const COLORS = {
  bg: "#05070D",
  card: "#0B1220",
  text: "#EAF0FF",
  muted: "rgba(234,240,255,0.65)",
  border: "rgba(234,240,255,0.12)",
  primary: "#4F46E5",
  danger: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
} as const;

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const SHADOW = {
  card: {
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
    shadowOffset: { width: 0, height: 8 },
  },
} as const;

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  loading?: boolean;

  /**
   * If true, wraps content in a ScrollView.
   * Use on long forms / detail pages.
   * Leave false for list screens (FlatList).
   */
  scroll?: boolean;

  padding?: number;
  style?: ViewStyle;
};

export default function Screen({
  children,
  title,
  subtitle,
  right,
  loading = false,
  scroll = false,
  padding = 16,
  style,
}: Props) {
  const inner = (
    <View style={[styles.content, { padding }, style]}>
      {(title || subtitle || right) && (
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        children
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.noScrollWrap}>{inner}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  noScrollWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
  },
  loadingWrap: {
    flex: 1,
    paddingTop: 30,
    alignItems: "center",
  },
});