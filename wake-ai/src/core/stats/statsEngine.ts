import type { AlarmEvent, PersonalityId, RepeatDay } from "@/types";

export interface DashboardStats {
  avgSecondsToConfirm: number;
  totalCompleted: number;
  totalSnoozes: number;
  avgIntensityNeeded: number;
  mostEffectivePersonality?: { id: PersonalityId; completionRate: number };
  bestDay?: RepeatDay;
  worstDay?: RepeatDay;
  currentStreak: number;
  bestStreak: number;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export function dayName(day: RepeatDay): string {
  return DAY_NAMES[day];
}

/** Pure function: events in, dashboard numbers out (spec §12). Easy to unit test. */
export function computeDashboardStats(events: AlarmEvent[]): DashboardStats {
  if (events.length === 0) {
    return {
      avgSecondsToConfirm: 0,
      totalCompleted: 0,
      totalSnoozes: 0,
      avgIntensityNeeded: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  const completed = events.filter((e) => e.completed && e.confirmedAwakeAt);
  const avgSecondsToConfirm =
    completed.length === 0
      ? 0
      : Math.round(
          completed.reduce((sum, e) => sum + (e.confirmedAwakeAt! - e.scheduledAt) / 1000, 0) / completed.length
        );

  const totalSnoozes = events.reduce((sum, e) => sum + e.snoozeCount, 0);
  const avgIntensityNeeded =
    Math.round((events.reduce((sum, e) => sum + e.maxIntensityReached, 0) / events.length) * 10) / 10;

  const byPersonality = new Map<PersonalityId, { done: number; total: number }>();
  for (const e of events) {
    const bucket = byPersonality.get(e.personalityId) ?? { done: 0, total: 0 };
    bucket.total += 1;
    if (e.completed) bucket.done += 1;
    byPersonality.set(e.personalityId, bucket);
  }
  let mostEffectivePersonality: DashboardStats["mostEffectivePersonality"];
  for (const [id, { done, total }] of byPersonality) {
    const rate = done / total;
    if (!mostEffectivePersonality || rate > mostEffectivePersonality.completionRate) {
      mostEffectivePersonality = { id, completionRate: rate };
    }
  }

  const byDay = new Map<RepeatDay, { done: number; total: number }>();
  for (const e of events) {
    const bucket = byDay.get(e.dayOfWeek) ?? { done: 0, total: 0 };
    bucket.total += 1;
    if (e.completed) bucket.done += 1;
    byDay.set(e.dayOfWeek, bucket);
  }
  let bestDay: RepeatDay | undefined;
  let worstDay: RepeatDay | undefined;
  let bestRate = -1;
  let worstRate = 2;
  for (const [day, { done, total }] of byDay) {
    const rate = done / total;
    if (rate > bestRate) {
      bestRate = rate;
      bestDay = day;
    }
    if (rate < worstRate) {
      worstRate = rate;
      worstDay = day;
    }
  }

  const { currentStreak, bestStreak } = computeStreaks(events);

  return {
    avgSecondsToConfirm,
    totalCompleted: completed.length,
    totalSnoozes,
    avgIntensityNeeded,
    mostEffectivePersonality,
    bestDay,
    worstDay,
    currentStreak,
    bestStreak,
  };
}

function computeStreaks(events: AlarmEvent[]): { currentStreak: number; bestStreak: number } {
  const sorted = [...events].sort((a, b) => a.scheduledAt - b.scheduledAt);
  let best = 0;
  let running = 0;
  for (const e of sorted) {
    if (e.completed) {
      running += 1;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }
  // current streak = trailing run of completed events at the end of history
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].completed) current += 1;
    else break;
  }
  return { currentStreak: current, bestStreak: best };
}

export function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}
