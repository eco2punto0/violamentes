import { AnthropicAIProvider } from "@/core/agent/anthropicProvider";
import { RuleBasedAIProvider } from "@/core/agent/ruleBasedProvider";
import type { AppSettings, IAIProvider } from "@/types";

const fallbackProvider = new RuleBasedAIProvider();

/**
 * Single seam where the app decides which AI backend talks to the user.
 * Default is the offline rule-based engine (always works, zero setup).
 * If the user opts in and supplies a key, we use the real LLM instead —
 * with an automatic fallback if the network call throws (bad key, offline).
 */
export function createAIProvider(settings: AppSettings): IAIProvider {
  if (settings.useLLM && settings.anthropicApiKey) {
    const llm = new AnthropicAIProvider(settings.anthropicApiKey);
    return {
      id: "anthropic-with-fallback",
      async generateReply(context) {
        try {
          return await llm.generateReply(context);
        } catch (err) {
          console.warn("[WAKE AI] Anthropic provider failed, falling back to rule-based:", err);
          return fallbackProvider.generateReply(context);
        }
      },
    };
  }
  return fallbackProvider;
}
