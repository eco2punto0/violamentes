import * as Speech from "expo-speech";
import type { PersonalityProfile } from "@/types";

export interface ITextToSpeech {
  speak(text: string, personality: PersonalityProfile, intensity: number, onDone?: () => void): void;
  stop(): void;
}

/**
 * Wraps expo-speech, the one speech API that works out of the box in Expo
 * Go on both platforms (no dev client needed) — see README §17. Pitch/rate
 * scale with intensity so the *voice itself* gets more urgent, not just the
 * words (spec §2's NIVEL 7/8 call for real vocal energy).
 */
export class ExpoTextToSpeech implements ITextToSpeech {
  speak(text: string, personality: PersonalityProfile, intensity: number, onDone?: () => void): void {
    Speech.stop();
    const intensityBoost = Math.min(0.35, (intensity - 1) * 0.035);
    Speech.speak(text, {
      language: "es-AR",
      pitch: personality.voice.pitch + intensityBoost / 2,
      rate: personality.voice.rate + intensityBoost,
      onDone,
      onStopped: onDone,
      onError: onDone,
    });
  }

  stop(): void {
    Speech.stop();
  }
}
