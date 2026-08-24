import type { AgentContext, AgentReply, IAIProvider, Strategy } from "@/types";
import { levelSpec } from "@/core/intensity/intensityEngine";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

const SAFETY_RULES = `
Reglas de seguridad, innegociables:
- Nunca amenaces de forma real, nunca humilles de manera extrema, nunca sugieras nada peligroso.
- No des instrucciones que puedan poner al usuario en riesgo físico.
- Podés ser insistente, provocador o exigente, pero siempre dentro de un tono de "coach duro", nunca abusivo.
- Respondé SIEMPRE en español rioplatense, en 1-2 frases cortas, listas para ser leídas en voz alta.
- Nunca rompas el personaje ni menciones que sos un modelo de lenguaje.
`.trim();

function buildSystemPrompt(context: AgentContext): string {
  const spec = levelSpec(context.intensity);
  return `
Sos WAKE AI, un agente de voz cuyo único objetivo es maximizar la probabilidad
de que el usuario se levante de la cama. No sos un despertador que reproduce
audio: sos un interlocutor real que conversa, negocia, motiva o presiona
según haga falta.

Personalidad activa: ${context.personality.name} (${context.personality.tagline}).
Tono: ${context.personality.tone.join(", ")}.

Nivel de intensidad actual: ${context.intensity}/10 — "${spec.label}": ${spec.description}
Estrategias permitidas en este nivel: ${spec.allowedStrategies.join(", ")}.
Modo de alarma: ${context.mode}${context.mode === "no_duermas" ? " (pedí una acción física concreta y esperá confirmación antes de seguir)" : ""}.

Hora objetivo: ${String(context.alarmTime.hour).padStart(2, "0")}:${String(context.alarmTime.minute).padStart(2, "0")}.
Segundos desde que empezó la alarma: ${context.secondsSinceAlarmStarted}.
Veces que pospuso hoy: ${context.snoozeCount}.
${context.personalGoal ? `Objetivo personal del usuario: ${context.personalGoal}.` : ""}
${context.memoryHints.length ? `Aprendizajes previos sobre este usuario: ${context.memoryHints.join("; ")}.` : ""}

${SAFETY_RULES}

Respondé ÚNICAMENTE con un JSON válido, sin texto extra, con esta forma:
{"text": string, "strategy": "convencer"|"motivar"|"humor"|"provocar"|"desafiar"|"negociar"|"insistir"|"consecuencias"|"objetivo_personal", "suggestedIntensityDelta": -1|0|1|2, "requiredAction": string|null}
`.trim();
}

function buildMessages(context: AgentContext) {
  const history = context.history.slice(-8).map((turn) => ({
    role: turn.speaker === "agent" ? ("assistant" as const) : ("user" as const),
    content: turn.text,
  }));
  if (context.lastUserUtterance && history[history.length - 1]?.content !== context.lastUserUtterance) {
    history.push({ role: "user", content: context.lastUserUtterance });
  }
  if (history.length === 0) {
    history.push({ role: "user", content: "(la alarma acaba de sonar, el usuario todavía no respondió)" });
  }
  return history;
}

/**
 * Real LLM-backed provider. Requires the user to paste their own Anthropic
 * API key in Settings (never bundled with the app). Talks directly to the
 * Messages API from the device — see README §15/§17 for why this is opt-in
 * rather than the default provider (network dependency + cost + latency).
 */
export class AnthropicAIProvider implements IAIProvider {
  readonly id = "anthropic";
  constructor(private apiKey: string) {}

  async generateReply(context: AgentContext): Promise<AgentReply> {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: buildSystemPrompt(context),
        messages: buildMessages(context),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = data.content?.find((b) => b.type === "text")?.text ?? "";
    return parseReply(raw);
  }
}

function parseReply(raw: string): AgentReply {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const strategy = (parsed.strategy ?? "insistir") as Strategy;
    const delta = [-1, 0, 1, 2].includes(parsed.suggestedIntensityDelta)
      ? (parsed.suggestedIntensityDelta as AgentReply["suggestedIntensityDelta"])
      : 0;
    return {
      text: String(parsed.text ?? "Vamos, es hora de levantarte."),
      strategy,
      suggestedIntensityDelta: delta,
      requiredAction: parsed.requiredAction ?? undefined,
    };
  } catch {
    // Model didn't return clean JSON — fail soft with the raw text so the
    // conversation doesn't just die.
    return {
      text: raw.trim() || "Vamos, es hora de levantarte.",
      strategy: "insistir",
      suggestedIntensityDelta: 0,
    };
  }
}
