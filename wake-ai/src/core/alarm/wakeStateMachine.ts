import type { WakeState } from "@/types";

/**
 * SLEEPING -> WAKING -> AWAKE -> CONFIRMED_AWAKE (spec §6). An alarm only
 * counts as "completed" once it reaches confirmed_awake — snoozing or just
 * dismissing the notification does not count (this feeds directly into the
 * stats/streak logic in core/stats).
 */
const TRANSITIONS: Record<WakeState, WakeState[]> = {
  sleeping: ["waking"],
  waking: ["awake", "sleeping"], // sleeping = user snoozed, cycle restarts
  awake: ["confirmed_awake", "waking"],
  confirmed_awake: [],
};

export function canTransition(from: WakeState, to: WakeState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Confirmation signals, ranked from weakest to strongest (spec §6 — the app
 * should combine multiple signals rather than trust just one):
 *  - screen: user tapped a button in the active-alarm UI
 *  - voice: STT transcript matched a compliance phrase
 *  - required_action: user completed every step of a no_duermas sequence
 * A single screen tap is enough for `awake`; `confirmed_awake` requires
 * either a voice confirmation or a completed action sequence, which is
 * harder to do half-asleep than a reflexive tap.
 */
export type ConfirmationSignal = "screen" | "voice" | "required_action";

export function evaluateConfirmation(
  current: WakeState,
  signal: ConfirmationSignal,
  requiredActionsRemaining: number
): WakeState {
  if (current === "sleeping" || current === "waking") {
    return "awake";
  }
  if (current === "awake") {
    if (signal === "voice" || (signal === "required_action" && requiredActionsRemaining <= 0)) {
      return "confirmed_awake";
    }
    if (signal === "screen") {
      // A screen tap alone isn't proof enough once we're already past the
      // first interaction — keep pushing for a stronger signal.
      return "awake";
    }
  }
  return current;
}
