import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { computeDashboardStats, dayName, formatSeconds, type DashboardStats } from "@/core/stats/statsEngine";
import { memoryStore, type MemoryInsight } from "@/core/memory/memoryStore";
import StatTile from "@/components/StatTile";
import GlowButton from "@/components/GlowButton";
import { theme } from "@/theme";
import { useWakeAIStore } from "@/state/store";
import type { AlarmEvent, RepeatDay } from "@/types";

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<MemoryInsight[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [appliedInsightIds, setAppliedInsightIds] = useState<string[]>([]);
  const { alarms, updateAlarm } = useWakeAIStore();

  async function applyInsight(insight: MemoryInsight) {
    if (!insight.action) return;
    const matching = alarms.filter((a) => a.days.includes(insight.action!.day));
    await Promise.all(
      matching.map((a) => updateAlarm({ ...a, personalityId: insight.action!.personalityId, updatedAt: Date.now() }))
    );
    setAppliedInsightIds((prev) => [...prev, insight.id]);
  }

  useEffect(() => {
    (async () => {
      const events: AlarmEvent[] = await memoryStore.getEvents();
      setStats(computeDashboardStats(events));
      setInsights(await memoryStore.getInsights());
      setEventCount(events.length);
    })();
  }, []);

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.muted}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  if (eventCount === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.muted}>Todavía no completaste ninguna alarma. Cuando lo hagas, tus estadísticas van a aparecer acá.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          <StatTile label="Tu promedio" value={formatSeconds(stats.avgSecondsToConfirm)} accent={theme.colors.primaryGlow} />
          <StatTile label="Alarmas completadas" value={String(stats.totalCompleted)} />
          <StatTile label="Veces que pospuso" value={String(stats.totalSnoozes)} />
          <StatTile label="Intensidad promedio" value={`${stats.avgIntensityNeeded}/10`} accent={theme.colors.warning} />
          <StatTile
            label="Personalidad más efectiva"
            value={stats.mostEffectivePersonality ? stats.mostEffectivePersonality.id : "—"}
            accent={theme.colors.accent}
          />
          <StatTile label="Mejor racha" value={`${stats.bestStreak} días`} accent={theme.colors.accent} />
          <StatTile label="Racha actual" value={`${stats.currentStreak} días`} />
          <StatTile label="Mejor día" value={stats.bestDay !== undefined ? dayName(stats.bestDay as RepeatDay) : "—"} />
          <StatTile label="Peor día" value={stats.worstDay !== undefined ? dayName(stats.worstDay as RepeatDay) : "—"} />
        </View>

        {insights.length > 0 && (
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>WAKE AI notó algo</Text>
            {insights.map((insight) => (
              <View key={insight.id} style={styles.insightCard}>
                <Text style={styles.insightText}>{insight.text}</Text>
                {insight.action && !appliedInsightIds.includes(insight.id) && (
                  <GlowButton label={insight.action.label} variant="outline" onPress={() => applyInsight(insight)} style={{ marginTop: 10 }} />
                )}
                {insight.action && appliedInsightIds.includes(insight.id) && (
                  <Text style={styles.appliedLabel}>Activado ✓</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 20 },
  content: { paddingVertical: 16, paddingBottom: 48 },
  muted: { color: theme.colors.textMuted, marginTop: 24, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  insightsSection: { marginTop: 28 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  insightCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 10 },
  insightText: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  appliedLabel: { color: theme.colors.accent, fontSize: 12, fontWeight: "700", marginTop: 8 },
});
