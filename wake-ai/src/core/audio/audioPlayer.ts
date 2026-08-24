import { Audio, AVPlaybackStatus } from "expo-av";

export interface PlayOptions {
  loop?: boolean;
  /** Ramp from ~10% to 100% volume over N seconds instead of blasting immediately (spec §5). */
  volumeRampSeconds?: number;
  initialVolume?: number;
}

export interface IAudioPlayer {
  play(source: number | string, options?: PlayOptions): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

/**
 * Thin wrapper around expo-av. Real playback (not simulated): works for both
 * bundled require()'d assets and user-imported file:// URIs from the sound
 * library's "add your own sound" flow.
 */
export class ExpoAudioPlayer implements IAudioPlayer {
  private sound: Audio.Sound | null = null;
  private rampTimer: ReturnType<typeof setInterval> | null = null;

  async play(source: number | string, options: PlayOptions = {}): Promise<void> {
    await this.stop();
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    const startVolume = options.volumeRampSeconds ? options.initialVolume ?? 0.1 : options.initialVolume ?? 1;
    const { sound } = await Audio.Sound.createAsync(
      typeof source === "string" ? { uri: source } : source,
      { isLooping: options.loop ?? true, volume: startVolume }
    );
    this.sound = sound;
    await sound.playAsync();

    if (options.volumeRampSeconds && options.volumeRampSeconds > 0) {
      this.rampVolume(startVolume, 1, options.volumeRampSeconds);
    }
  }

  private rampVolume(from: number, to: number, seconds: number) {
    const steps = Math.max(1, Math.round(seconds));
    let step = 0;
    this.rampTimer = setInterval(async () => {
      step += 1;
      const v = from + ((to - from) * step) / steps;
      await this.sound?.setVolumeAsync(Math.min(1, v)).catch(() => {});
      if (step >= steps && this.rampTimer) {
        clearInterval(this.rampTimer);
        this.rampTimer = null;
      }
    }, 1000);
  }

  async stop(): Promise<void> {
    if (this.rampTimer) {
      clearInterval(this.rampTimer);
      this.rampTimer = null;
    }
    if (this.sound) {
      const status = (await this.sound.getStatusAsync().catch(() => null)) as AVPlaybackStatus | null;
      if (status && "isLoaded" in status && status.isLoaded) {
        await this.sound.stopAsync().catch(() => {});
      }
      await this.sound.unloadAsync().catch(() => {});
      this.sound = null;
    }
  }

  async setVolume(volume: number): Promise<void> {
    await this.sound?.setVolumeAsync(Math.max(0, Math.min(1, volume)));
  }
}
