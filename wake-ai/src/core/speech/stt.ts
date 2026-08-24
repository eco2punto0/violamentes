import { Platform } from "react-native";

export interface ISpeechToText {
  readonly isSupported: boolean;
  /** Human-readable reason isSupported is false, shown in the UI instead of pretending it works. */
  readonly unsupportedReason?: string;
  start(onPartial: (text: string) => void, onFinal: (text: string) => void, onError: (err: string) => void): void;
  stop(): void;
}

/**
 * Native STT via `expo-speech-recognition`. IMPORTANT LIMITATION (spec §17):
 * this package ships a native module, so it does NOT run inside the plain
 * "Expo Go" app — it needs a custom dev client (`npx expo run:android` /
 * `npx expo run:ios`, or an EAS dev build). We detect that at runtime
 * instead of pretending it always works.
 */
export class NativeSpeechToText implements ISpeechToText {
  isSupported = true;
  unsupportedReason?: string;
  private stopFn?: () => void;

  constructor() {
    try {
      // Lazy require: on Expo Go this either throws or the native module is
      // absent, which we surface instead of silently no-op-ing.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("expo-speech-recognition");
    } catch {
      this.isSupported = false;
      this.unsupportedReason =
        "El reconocimiento de voz nativo requiere una build de desarrollo (npx expo run:android/ios), no funciona dentro de Expo Go.";
    }
  }

  start(onPartial: (text: string) => void, onFinal: (text: string) => void, onError: (err: string) => void): void {
    if (!this.isSupported) {
      onError(this.unsupportedReason ?? "STT no soportado en este entorno.");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ExpoSpeechRecognitionModule = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
      const listeners: { remove: () => void }[] = [];
      listeners.push(
        ExpoSpeechRecognitionModule.addListener("result", (event: any) => {
          const transcript = event.results?.[0]?.transcript ?? "";
          if (event.isFinal) onFinal(transcript);
          else onPartial(transcript);
        })
      );
      listeners.push(
        ExpoSpeechRecognitionModule.addListener("error", (event: any) => {
          onError(event.error ?? "Error de reconocimiento de voz");
        })
      );
      ExpoSpeechRecognitionModule.start({ lang: "es-AR", interimResults: true, continuous: false });
      this.stopFn = () => {
        ExpoSpeechRecognitionModule.stop();
        listeners.forEach((l) => l.remove());
      };
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  stop(): void {
    this.stopFn?.();
    this.stopFn = undefined;
  }
}

/** Browser fallback so `expo start --web` gives a real, testable voice loop today. */
export class WebSpeechToText implements ISpeechToText {
  isSupported: boolean;
  unsupportedReason?: string;
  private recognition: any;

  constructor() {
    const SpeechRecognitionCtor = (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;
    this.isSupported = Platform.OS === "web" && !!SpeechRecognitionCtor;
    if (!this.isSupported) {
      this.unsupportedReason = "Este navegador no soporta la Web Speech API.";
    } else {
      this.recognition = new SpeechRecognitionCtor();
      this.recognition.lang = "es-AR";
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
    }
  }

  start(onPartial: (text: string) => void, onFinal: (text: string) => void, onError: (err: string) => void): void {
    if (!this.isSupported) {
      onError(this.unsupportedReason ?? "STT no soportado en este entorno.");
      return;
    }
    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      if (result.isFinal) onFinal(transcript);
      else onPartial(transcript);
    };
    this.recognition.onerror = (event: any) => onError(event.error ?? "Error de reconocimiento de voz");
    this.recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }
}

/** Text-input fallback: always "supported", used when no voice input is available. */
export class TypedFallbackSTT implements ISpeechToText {
  isSupported = true;
  start(): void {
    // No-op: the UI should render a text field instead of calling start().
  }
  stop(): void {}
}

export function createSpeechToText(): ISpeechToText {
  if (Platform.OS === "web") return new WebSpeechToText();
  const native = new NativeSpeechToText();
  return native.isSupported ? native : native; // caller checks isSupported and shows TypedFallback UI
}
