import React from "react"
import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { COLORS } from "../../lib/ui"

function icon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.bg },
        headerTitleStyle: { color: COLORS.text, fontWeight: "900" },
        headerTintColor: COLORS.text,

        tabBarStyle: { backgroundColor: COLORS.bg, borderTopColor: COLORS.border },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          tabBarIcon: icon("briefcase-outline"),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: "Invoices",
          tabBarIcon: icon("receipt-outline"),
        }}
      />
      <Tabs.Screen
        name="mileage"
        options={{
          title: "Mileage",
          tabBarIcon: icon("speedometer-outline"),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: icon("card-outline"),
        }}
      />
      
<Tabs.Screen
  name="reports"
  options={{
    title: "Reports",
    tabBarIcon: icon("bar-chart-outline"),
  }}
/>
<Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: icon("settings-outline"),
        }}
      />
    </Tabs>
  )
}
