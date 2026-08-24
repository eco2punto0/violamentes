import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import type { AlarmMode } from "@/types";

const OPTIONS: { id: AlarmMode; label: string; description: string }[] = [
  { id: "normal", label: "Normal", description: "Conversación estándar, escalamiento gradual." },
  { id: "no_duermas", label: "No me dejes dormir", description: "Secuencia de acciones obligatorias hasta confirmar." },
  { id: "extremo", label: "Extremo", description: "Máxima intensidad disponible desde el inicio." },
];

interface Props {
  value: AlarmMode;
  onChange: (mode: AlarmMode) => void;
}

export default function ModeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable key={opt.id} onPress={() => onChange(opt.id)} style={[styles.option, selected && styles.optionSelected]}>
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
            <Text style={styles.description}>{opt.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  option: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceRaised },
  label: { color: theme.colors.text, fontWeight: "700", fontSize: 15 },
  labelSelected: { color: theme.colors.primaryGlow },
  description: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
});
