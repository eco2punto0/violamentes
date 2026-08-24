import { kvStorage, STORAGE_KEYS } from "@/core/storage/kvStorage";
import { computeDashboardStats, dayName } from "@/core/stats/statsEngine";
import type { AlarmEvent, PersonalityId, RepeatDay, Strategy, UserMemoryProfile } from "@/types";

export interface MemoryInsight {
  id: string;
  text: string;
  action?: { label: string; kind: "auto_personality_on_day"; day: RepeatDay; personalityId: PersonalityId };
}

/**
 * Learning layer (spec §8/§9): logs every alarm cycle and derives a
 * UserMemoryProfile + human-readable insights ("los lunes necesitás más
 * intensidad, ¿activo Coach automáticamente?"). Backed by AsyncStorage so it
 * survives app restarts without needing a backend.
 */
export class MemoryStore {
  async recordEvent(event: AlarmEvent): Promise<void> {
    const events = await this.getEvents();
    events.push(event);
    await kvStorage.set(STORAGE_KEYS.events, events);
    await this.recomputeProfile(events);
  }

  async getEvents(): Promise<AlarmEvent[]> {
    return kvStorage.get<AlarmEvent[]>(STORAGE_KEYS.events, []);
  }

  async getProfile(): Promise<UserMemoryProfile> {
    return kvStorage.get<UserMemoryProfile>(STORAGE_KEYS.userProfile, emptyProfile());
  }

  private async recomputeProfile(events: AlarmEvent[]): Promise<void> {
    const stats = computeDashboardStats(events);
    const byPersonality = new Map<PersonalityId, { done: number; total: number }>();
    const byDayIntensity = new Map<RepeatDay, number[]>();
    for (const e of events) {
      const p = byPersonality.get(e.personalityId) ?? { done: 0, total: 0 };
      p.total += 1;
      if (e.completed) p.done += 1;
      byPersonality.set(e.personalityId, p);

      const arr = byDayIntensity.get(e.dayOfWeek) ?? [];
      arr.push(e.maxIntensityReached);
      byDayIntensity.set(e.dayOfWeek, arr);
    }

    const personalityEffectiveness: UserMemoryProfile["personalityEffectiveness"] = {};
    for (const [id, { done, total }] of byPersonality) {
      personalityEffectiveness[id] = done / total;
    }
    const intensityNeededByDay: UserMemoryProfile["intensityNeededByDay"] = {};
    for (const [day, arr] of byDayIntensity) {
      intensityNeededByDay[day] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    const profile: UserMemoryProfile = {
      totalAlarms: events.length,
      totalSnoozes: stats.totalSnoozes,
      avgSecondsToConfirm: stats.avgSecondsToConfirm,
      personalityEffectiveness,
      intensityNeededByDay,
      bestDay: stats.bestDay,
      worstDay: stats.worstDay,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      lastUpdated: Date.now(),
    };
    await kvStorage.set(STORAGE_KEYS.userProfile, profile);
  }

  /**
   * Returns short strings like "coach:desafiar" the intensity engine's
   * level-9 branch reads to reuse historically successful strategies
   * (spec §2 NIVEL 9).
   */
  async getMemoryHints(personalityId: PersonalityId): Promise<string[]> {
    const events = await this.getEvents();
    const relevant = events.filter((e) => e.personalityId === personalityId && e.completed);
    const strategyCounts = new Map<Strategy, number>();
    for (const e of relevant) {
      for (const s of e.strategiesUsed) {
        strategyCounts.set(s, (strategyCounts.get(s) ?? 0) + 1);
      }
    }
    return [...strategyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([strategy]) => `${personalityId}:${strategy}`);
  }

  /** Human-facing insights for the dashboard (spec §8 example). */
  async getInsights(): Promise<MemoryInsight[]> {
    const events = await this.getEvents();
    if (events.length < 5) return [];
    const profile = await this.getProfile();
    const insights: MemoryInsight[] = [];

    for (const [dayStr, avgIntensity] of Object.entries(profile.intensityNeededByDay)) {
      const day = Number(dayStr) as RepeatDay;
      const overallAvg =
        Object.values(profile.intensityNeededByDay).reduce((a, b) => a + b, 0) /
        Math.max(1, Object.keys(profile.intensityNeededByDay).length);
      if (avgIntensity >= overallAvg + 1.5) {
        const best = Object.entries(profile.personalityEffectiveness).sort((a, b) => b[1] - a[1])[0];
        insights.push({
          id: `day-${day}`,
          text: `Noté que los ${dayName(day).toLowerCase()} necesitás una intensidad mayor.${
            best ? ` ¿Querés que active automáticamente ${best[0]} ese día?` : ""
          }`,
          action: best
            ? { label: `Activar ${best[0]} los ${dayName(day).toLowerCase()}`, kind: "auto_personality_on_day", day, personalityId: best[0] as PersonalityId }
            : undefined,
        });
      }
    }

    return insights;
  }
}

function emptyProfile(): UserMemoryProfile {
  return {
    totalAlarms: 0,
    totalSnoozes: 0,
    avgSecondsToConfirm: 0,
    personalityEffectiveness: {},
    intensityNeededByDay: {},
    currentStreak: 0,
    bestStreak: 0,
    lastUpdated: Date.now(),
  };
}

export const memoryStore = new MemoryStore();
