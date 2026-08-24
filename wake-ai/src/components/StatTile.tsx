import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";

interface Props {
  label: string;
  value: string;
  accent?: string;
}

export default function StatTile({ label, value, accent }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.value, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 6,
  },
  value: { color: theme.colors.text, fontSize: 26, fontWeight: "700" },
  label: { color: theme.colors.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
});
