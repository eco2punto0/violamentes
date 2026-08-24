/**
 * Domain types shared across every module (agent, alarm, memory, UI).
 * Keeping this file provider-agnostic is what lets us swap the AI/STT/TTS
 * implementations later without touching the rest of the app (see README §14).
 */

export type PersonalityId =
  | "friend"
  | "coach"
  | "military"
  | "comedian"
  | "motivator"
  | "strict"
  | "custom";

export interface PersonalityProfile {
  id: PersonalityId;
  name: string;
  tagline: string;
  /** Adjectives that steer the rule-based generator's word choice. */
  tone: string[];
  /** expo-speech tuning so each personality *sounds* different, not just reads different. */
  voice: {
    pitch: number; // 0.5 - 2.0
    rate: number; // 0.5 - 2.0
  };
  /** True only for the single user-authored slot. */
  isCustom?: boolean;
}

/** 1 (SUAVE) .. 10 (MODO EXTREMO), per spec §2. */
export type IntensityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * The persuasion "move" the agent is making right now. The engine chooses
 * one of these per turn instead of just turning the volume up (spec §2 IMPORTANTE).
 */
export type Strategy =
  | "convencer"
  | "motivar"
  | "humor"
  | "provocar"
  | "desafiar"
  | "negociar"
  | "insistir"
  | "consecuencias"
  | "objetivo_personal";

export type AlarmMode = "normal" | "no_duermas" | "extremo";

export type RepeatDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo ... 6 = sábado

export interface Alarm {
  id: string;
  label?: string;
  hour: number; // 0-23
  minute: number; // 0-59
  days: RepeatDay[]; // empty = one-shot
  personalityId: PersonalityId;
  startingIntensity: IntensityLevel;
  maxIntensity: IntensityLevel;
  soundId: string;
  mode: AlarmMode;
  personalGoal?: string; // e.g. "entrenar antes del trabajo" — used by the objetivo_personal strategy
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type WakeState = "sleeping" | "waking" | "awake" | "confirmed_awake";

export interface ConversationTurn {
  id: string;
  speaker: "agent" | "user";
  text: string;
  timestamp: number;
  intensityAtTurn?: IntensityLevel;
  strategyAtTurn?: Strategy;
}

/** Everything the AI needs to produce a grounded reply — spec §15. */
export interface AgentContext {
  now: number;
  alarmTime: { hour: number; minute: number };
  wakeState: WakeState;
  intensity: IntensityLevel;
  maxIntensity: IntensityLevel;
  personality: PersonalityProfile;
  history: ConversationTurn[];
  snoozeCount: number;
  secondsSinceAlarmStarted: number;
  lastUserUtterance?: string;
  personalGoal?: string;
  mode: AlarmMode;
  /** Learned facts about this user, e.g. "responde bien a humor los lunes". */
  memoryHints: string[];
}

export interface AgentReply {
  text: string;
  strategy: Strategy;
  /** Suggested next intensity (engine has final say, but the AI can request an escalation). */
  suggestedIntensityDelta: -1 | 0 | 1 | 2;
  /** For the "no me dejes dormir" mode: a concrete action the user must confirm. */
  requiredAction?: string;
}

export interface IAIProvider {
  readonly id: string;
  generateReply(context: AgentContext): Promise<AgentReply>;
}

export type SoundCategory =
  | "Relax"
  | "Energía"
  | "Electrónica"
  | "Rock"
  | "Naturaleza"
  | "Caos"
  | "Comedia"
  | "Emergencia";

export interface SoundAsset {
  id: string;
  name: string;
  category: SoundCategory;
  /** Local module (bundled) or file:// / content:// uri (user-imported). */
  source: number | string;
  isCustom?: boolean;
}

/** One completed (or abandoned) alarm cycle, logged for memory + stats — spec §8/§12. */
export interface AlarmEvent {
  id: string;
  alarmId: string;
  personalityId: PersonalityId;
  scheduledAt: number;
  firstInteractionAt?: number;
  confirmedAwakeAt?: number;
  snoozeCount: number;
  maxIntensityReached: IntensityLevel;
  strategiesUsed: Strategy[];
  dayOfWeek: RepeatDay;
  completed: boolean; // true only if it reached confirmed_awake
}

export interface UserMemoryProfile {
  totalAlarms: number;
  totalSnoozes: number;
  avgSecondsToConfirm: number;
  personalityEffectiveness: Partial<Record<PersonalityId, number>>; // 0..1 completion rate
  intensityNeededByDay: Partial<Record<RepeatDay, number>>; // avg max intensity reached
  bestDay?: RepeatDay;
  worstDay?: RepeatDay;
  currentStreak: number;
  bestStreak: number;
  lastUpdated: number;
}

export interface AppSettings {
  anthropicApiKey?: string;
  useLLM: boolean;
  hapticsEnabled: boolean;
  progressiveVolume: boolean;
}
