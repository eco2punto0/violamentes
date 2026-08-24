import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { theme } from "@/theme";
import type { Alarm } from "@/types";
import { getPersonality } from "@/core/personality/personalities";
import { dayName } from "@/core/stats/statsEngine";
import type { RepeatDay } from "@/types";

interface Props {
  alarm: Alarm;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
}

export default function AlarmCard({ alarm, onPress, onToggle }: Props) {
  const personality = getPersonality(alarm.personalityId, []);
  const time = `${String(alarm.hour).padStart(2, "0")}:${String(alarm.minute).padStart(2, "0")}`;
  const days = alarm.days.length === 7 ? "Todos los días" : alarm.days.length === 0 ? "Una vez" : alarm.days.map((d) => dayName(d as RepeatDay).slice(0, 3)).join(" ");

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.left}>
        <Text style={[styles.time, !alarm.enabled && styles.dim]}>{time}</Text>
        <Text style={[styles.meta, !alarm.enabled && styles.dim]}>
          {personality.name} · Intensidad {alarm.startingIntensity}→{alarm.maxIntensity} · {days}
        </Text>
        {alarm.mode !== "normal" && (
          <Text style={styles.badge}>{alarm.mode === "no_duermas" ? "No me dejes dormir" : "Extremo"}</Text>
        )}
      </View>
      <Switch
        value={alarm.enabled}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#fff"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
  },
  left: { flex: 1, gap: 4 },
  time: { color: theme.colors.text, fontSize: 32, fontWeight: "700" },
  meta: { color: theme.colors.textMuted, fontSize: 13 },
  dim: { opacity: 0.4 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 4,
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
