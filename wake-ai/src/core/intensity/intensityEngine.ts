import type { AgentContext, IntensityLevel, Strategy } from "@/types";

export interface IntensityLevelSpec {
  level: IntensityLevel;
  label: string;
  description: string;
  /** Strategies that make sense at this level; the agent picks among these. */
  allowedStrategies: Strategy[];
}

/** Table straight out of spec §2 (NIVEL 1 SUAVE .. NIVEL 10 MODO EXTREMO). */
export const INTENSITY_LEVELS: IntensityLevelSpec[] = [
  { level: 1, label: "Suave", description: "Voz tranquila.", allowedStrategies: ["convencer"] },
  { level: 2, label: "Motivador", description: "Invitación amable a arrancar distinto.", allowedStrategies: ["convencer", "motivar"] },
  { level: 3, label: "Persuasivo", description: "Se marca un límite corto y concreto.", allowedStrategies: ["convencer", "negociar"] },
  { level: 4, label: "Insistente", description: "Se hace notar el tiempo ya transcurrido.", allowedStrategies: ["insistir", "consecuencias"] },
  { level: 5, label: "Entrenador", description: "Órdenes cortas, tono de coach.", allowedStrategies: ["desafiar", "insistir"] },
  { level: 6, label: "Provocador", description: "Se apela al orgullo / autoimagen.", allowedStrategies: ["provocar", "desafiar"] },
  { level: 7, label: "Enérgico", description: "Máxima energía verbal.", allowedStrategies: ["insistir", "desafiar", "provocar"] },
  { level: 8, label: "Caótico", description: "Se combina voz + música + sonidos.", allowedStrategies: ["insistir", "provocar", "humor"] },
  {
    level: 9,
    label: "Máxima insistencia",
    description: "Se usan las estrategias que históricamente mejor funcionaron con este usuario.",
    allowedStrategies: ["consecuencias", "objetivo_personal", "provocar", "desafiar"],
  },
  {
    level: 10,
    label: "Modo extremo",
    description: "Máxima intensidad permitida por la configuración del usuario.",
    allowedStrategies: ["consecuencias", "objetivo_personal", "provocar", "desafiar", "insistir"],
  },
];

export function levelSpec(level: IntensityLevel): IntensityLevelSpec {
  return INTENSITY_LEVELS[level - 1];
}

const RESISTANCE_PATTERNS: RegExp[] = [
  /cinco minutos|5 min/i,
  /cansad[oa]|muert[oa]|agotad[oa]/i,
  /dej[aá]me dormir|un rato m[aá]s|todav[ií]a no/i,
  /despu[eé]s|m[aá]s tarde/i,
  /no quiero|no puedo/i,
];

const COMPLIANCE_PATTERNS: RegExp[] = [
  /listo|ya est[aá]|me levant[eé]|de pie|parad[oa]|sentad[oa]/i,
  /ok(ay)?|dale|bueno|voy/i,
  /despierto|desperté/i,
];

export type UtteranceSignal = "resistance" | "compliance" | "neutral";

export function classifyUtterance(text?: string): UtteranceSignal {
  if (!text) return "neutral";
  if (RESISTANCE_PATTERNS.some((r) => r.test(text))) return "resistance";
  if (COMPLIANCE_PATTERNS.some((r) => r.test(text))) return "compliance";
  return "neutral";
}

/**
 * Decide the next intensity level. This is deliberately NOT "always go up":
 * compliance signals hold or ease the level, silence/resistance escalate,
 * and escalation speed depends on elapsed time and snooze count — per the
 * spec's explicit warning that intensity must adapt to behavior, not just
 * get louder over time.
 */
export function computeNextIntensity(
  current: IntensityLevel,
  maxIntensity: IntensityLevel,
  signal: UtteranceSignal,
  secondsSinceAlarmStarted: number,
  snoozeCount: number
): IntensityLevel {
  let next = current;

  if (signal === "compliance") {
    next = Math.max(1, current - 1) as IntensityLevel;
  } else if (signal === "resistance") {
    next = Math.min(maxIntensity, current + 1) as IntensityLevel;
  } else {
    // neutral / silence: escalate faster the longer the user has been unresponsive.
    const bump = secondsSinceAlarmStarted > 90 ? 2 : 1;
    next = Math.min(maxIntensity, current + bump) as IntensityLevel;
  }

  // Repeated snoozing means yesterday's approach failed — skip ahead a bit.
  if (snoozeCount >= 2) {
    next = Math.min(maxIntensity, (next + 1) as IntensityLevel) as IntensityLevel;
  }

  return next as IntensityLevel;
}

/**
 * Picks a strategy for this turn. At level 9 ("usa lo que históricamente
 * funcionó") we prefer memoryHints over the default rotation when available.
 */
export function pickStrategy(context: AgentContext): Strategy {
  const spec = levelSpec(context.intensity);
  const pool = spec.allowedStrategies;

  if (context.intensity >= 9 && context.memoryHints.length > 0) {
    // memoryHints encode things like "coach:desafiar" learned from past success.
    const hinted = context.memoryHints
      .map((h) => h.split(":")[1] as Strategy | undefined)
      .find((s) => s && pool.includes(s));
    if (hinted) return hinted;
  }

  if (context.personalGoal && pool.includes("objetivo_personal") && context.snoozeCount >= 1) {
    return "objetivo_personal";
  }

  if (context.snoozeCount >= 2 && pool.includes("consecuencias")) {
    return "consecuencias";
  }

  // Rotate deterministically through the pool based on turn count so we
  // don't repeat the exact same move twice in a row.
  const idx = context.history.length % pool.length;
  return pool[idx];
}
