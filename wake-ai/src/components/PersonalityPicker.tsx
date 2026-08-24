import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import { ALL_BUILTIN_PERSONALITIES } from "@/core/personality/personalities";
import type { PersonalityId, PersonalityProfile } from "@/types";

interface Props {
  value: PersonalityId;
  onChange: (id: PersonalityId) => void;
  customPersonalities: PersonalityProfile[];
  onCreateCustom: () => void;
}

export default function PersonalityPicker({ value, onChange, customPersonalities, onCreateCustom }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {ALL_BUILTIN_PERSONALITIES.map((p) => (
        <Card key={p.id} personality={p} selected={value === p.id} onPress={() => onChange(p.id)} />
      ))}
      {customPersonalities.map((p) => (
        <Card key={p.id + p.name} personality={p} selected={value === "custom"} onPress={() => onChange("custom")} />
      ))}
      <Pressable style={[styles.card, styles.addCard]} onPress={onCreateCustom}>
        <Text style={styles.addPlus}>+</Text>
        <Text style={styles.addLabel}>Custom</Text>
      </Pressable>
    </ScrollView>
  );
}

function Card({ personality, selected, onPress }: { personality: PersonalityProfile; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <Text style={[styles.name, selected && styles.nameSelected]}>{personality.name}</Text>
      <Text style={styles.tagline} numberOfLines={3}>
        {personality.tagline}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingVertical: 8 },
  card: {
    width: 148,
    minHeight: 108,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    justifyContent: "space-between",
  },
  cardSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceRaised },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  nameSelected: { color: theme.colors.primaryGlow },
  tagline: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  addCard: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  addPlus: { color: theme.colors.primary, fontSize: 28, fontWeight: "700" },
  addLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
});
