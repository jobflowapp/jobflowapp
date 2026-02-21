// mobile/components/JobPicker.tsx
import { View, Text, StyleSheet } from "react-native"
import { Picker } from "@react-native-picker/picker"
import type { Job } from "../lib/types"

type Props = {
  label?: string
  jobs: Job[]
  value: number | null
  onChange: (jobId: number | null) => void
  allowNone?: boolean
}

export default function JobPicker({ label = "Job", jobs, value, onChange, allowNone = true }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value === null ? "none" : String(value)}
          onValueChange={(v) => {
            if (v === "none") onChange(null)
            else onChange(Number(v))
          }}
        >
          {allowNone ? <Picker.Item label="None" value="none" /> : null}
          {jobs.map((j) => (
            <Picker.Item
              key={j.id}
              label={`${j.title}${j.client_name ? ` (${j.client_name})` : ""}`}
              value={String(j.id)}
            />
          ))}
        </Picker>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { color: "#555", marginBottom: 6 },
  pickerWrap: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, overflow: "hidden" },
})
