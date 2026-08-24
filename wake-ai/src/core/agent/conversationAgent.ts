import { computeNextIntensity, classifyUtterance } from "@/core/intensity/intensityEngine";
import type {
  AgentContext,
  Alarm,
  ConversationTurn,
  IAIProvider,
  IntensityLevel,
  PersonalityProfile,
  Strategy,
  WakeState,
} from "@/types";

export interface ConversationState {
  wakeState: WakeState;
  intensity: IntensityLevel;
  history: ConversationTurn[];
  snoozeCount: number;
  strategiesUsed: Strategy[];
  startedAt: number;
  pendingAction?: string;
}

let turnCounter = 0;
function nextId() {
  turnCounter += 1;
  return `turn_${Date.now()}_${turnCounter}`;
}

/**
 * Orchestrates one wake session: owns ConversationState, talks to the
 * pluggable IAIProvider, and exposes a small API the UI/alarm layer drives.
 * This is where STT transcript -> AI -> TTS text ties together (spec §4).
 */
export class ConversationAgent {
  state: ConversationState;

  constructor(
    private alarm: Alarm,
    private personality: PersonalityProfile,
    private provider: IAIProvider,
    private memoryHints: string[]
  ) {
    this.state = {
      wakeState: "sleeping",
      intensity: alarm.startingIntensity,
      history: [],
      snoozeCount: 0,
      strategiesUsed: [],
      startedAt: Date.now(),
    };
  }

  private buildContext(lastUserUtterance?: string): AgentContext {
    return {
      now: Date.now(),
      alarmTime: { hour: this.alarm.hour, minute: this.alarm.minute },
      wakeState: this.state.wakeState,
      intensity: this.state.intensity,
      maxIntensity: this.alarm.maxIntensity,
      personality: this.personality,
      history: this.state.history,
      snoozeCount: this.state.snoozeCount,
      secondsSinceAlarmStarted: Math.round((Date.now() - this.state.startedAt) / 1000),
      lastUserUtterance,
      personalGoal: this.alarm.personalGoal,
      mode: this.alarm.mode,
      memoryHints: this.memoryHints,
    };
  }

  /** Called once when the alarm fires. Returns the agent's opening line. */
  async start(): Promise<ConversationTurn> {
    this.state.wakeState = "waking";
    const context = this.buildContext();
    const reply = await this.provider.generateReply(context);
    return this.applyReply(reply);
  }

  /** Called with a finalized STT transcript (or a UI-typed fallback). */
  async handleUserUtterance(text: string): Promise<ConversationTurn> {
    const userTurn: ConversationTurn = {
      id: nextId(),
      speaker: "user",
      text,
      timestamp: Date.now(),
    };
    this.state.history.push(userTurn);

    if (this.state.wakeState === "waking") {
      this.state.wakeState = "awake";
    }

    const context = this.buildContext(text);
    const reply = await this.provider.generateReply(context);
    return this.applyReply(reply);
  }

  /** Called periodically while the user stays silent, to auto-escalate. */
  async handleSilenceTick(): Promise<ConversationTurn | null> {
    if (this.state.wakeState === "confirmed_awake") return null;
    const context = this.buildContext();
    const nextIntensity = computeNextIntensity(
      this.state.intensity,
      this.alarm.maxIntensity,
      classifyUtterance(undefined),
      context.secondsSinceAlarmStarted,
      this.state.snoozeCount
    );
    this.state.intensity = nextIntensity;
    const reply = await this.provider.generateReply(this.buildContext());
    return this.applyReply(reply);
  }

  registerSnooze() {
    this.state.snoozeCount += 1;
    this.state.wakeState = "waking";
  }

  confirmAwake() {
    this.state.wakeState = "confirmed_awake";
  }

  private applyReply(reply: Awaited<ReturnType<IAIProvider["generateReply"]>>): ConversationTurn {
    const clamped = Math.max(1, Math.min(this.alarm.maxIntensity, this.state.intensity + reply.suggestedIntensityDelta));
    this.state.intensity = clamped as IntensityLevel;
    this.state.strategiesUsed.push(reply.strategy);
    this.state.pendingAction = reply.requiredAction;

    const agentTurn: ConversationTurn = {
      id: nextId(),
      speaker: "agent",
      text: reply.text,
      timestamp: Date.now(),
      intensityAtTurn: this.state.intensity,
      strategyAtTurn: reply.strategy,
    };
    this.state.history.push(agentTurn);
    return agentTurn;
  }
}
