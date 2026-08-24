import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";
import { intensityColor, theme } from "@/theme";
import { levelSpec } from "@/core/intensity/intensityEngine";
import type { IntensityLevel } from "@/types";

interface Props {
  value: IntensityLevel;
  onChange: (v: IntensityLevel) => void;
  label?: string;
}

export default function IntensitySlider({ value, onChange, label = "Intensidad" }: Props) {
  const spec = levelSpec(value);
  const color = intensityColor(value);
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>
          {value}/10 · {spec.label}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={value}
        minimumTrackTintColor={color}
        maximumTrackTintColor={theme.colors.border}
        thumbTintColor={color}
        onValueChange={(v) => onChange(Math.round(v) as IntensityLevel)}
      />
      <Text style={styles.description}>{spec.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: theme.colors.text, ...theme.font.subtitle },
  value: { ...theme.font.subtitle },
  slider: { width: "100%", height: 40 },
  description: { color: theme.colors.textMuted, ...theme.font.body },
});
