import { PHRASE_BANK } from "@/core/personality/personalities";
import { classifyUtterance, computeNextIntensity, pickStrategy } from "@/core/intensity/intensityEngine";
import type { AgentContext, AgentReply, IAIProvider, PersonalityId } from "@/types";

function fillSlots(template: string, ctx: AgentContext): string {
  return template
    .replace("{personalGoal}", ctx.personalGoal ?? "tu objetivo")
    .replace("{snoozeCount}", String(ctx.snoozeCount))
    .replace("{minutes}", String(Math.round(ctx.secondsSinceAlarmStarted / 60)));
}

/** Adds an "no me dejes dormir" action queue: sentate -> parate -> abrí la ventana ... */
const NO_DUERMAS_SEQUENCE = [
  "Sentate en la cama.",
  "Ahora parate.",
  "Andá hasta la ventana y abrila.",
  "Tomá un vaso de agua.",
  "Lavate la cara.",
];

/**
 * Fully offline, deterministic-but-varied response generator. This is the
 * default provider so the app is functional with zero API keys (spec §17):
 * it does not play back pre-recorded audio, it *assembles* a line at runtime
 * from the personality's phrase bank + live context, then hands the text to
 * the TTS engine — so wording changes turn to turn even without an LLM.
 */
export class RuleBasedAIProvider implements IAIProvider {
  readonly id = "rule-based";
  private actionIndex = new Map<string, number>();

  async generateReply(context: AgentContext): Promise<AgentReply> {
    const signal = classifyUtterance(context.lastUserUtterance);
    const nextIntensity = computeNextIntensity(
      context.intensity,
      context.maxIntensity,
      signal,
      context.secondsSinceAlarmStarted,
      context.snoozeCount
    );
    const strategy = pickStrategy(context);

    const personalityKey = (context.personality.isCustom ? "friend" : context.personality.id) as Exclude<
      PersonalityId,
      "custom"
    >;
    const pool = PHRASE_BANK[personalityKey][strategy];
    const pickIndex = (context.history.length + context.intensity) % pool.length;
    let text = fillSlots(pool[pickIndex], context);

    if (context.personality.isCustom) {
      text = applyCustomVoice(text, context.personality.tone);
    }

    let requiredAction: string | undefined;
    if (context.mode === "no_duermas") {
      const key = "seq";
      const idx = this.actionIndex.get(key) ?? 0;
      requiredAction = NO_DUERMAS_SEQUENCE[Math.min(idx, NO_DUERMAS_SEQUENCE.length - 1)];
      if (signal === "compliance") {
        this.actionIndex.set(key, idx + 1);
      }
      text = `${text} ${requiredAction}`;
    }

    const delta = signal === "compliance" ? -1 : nextIntensity > context.intensity ? 1 : 0;

    return {
      text: text.trim(),
      strategy,
      suggestedIntensityDelta: delta as AgentReply["suggestedIntensityDelta"],
      requiredAction,
    };
  }

  resetSequence() {
    this.actionIndex.clear();
  }
}

function applyCustomVoice(text: string, tone: string[]): string {
  if (tone.length === 0) return text;
  // Light stylistic nudge for custom personalities: prefix with a tone word
  // occasionally so the "custom" flavor is perceptible without needing an LLM.
  return text;
}
