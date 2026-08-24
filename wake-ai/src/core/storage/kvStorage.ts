import AsyncStorage from "@react-native-async-storage/async-storage";

/** Thin typed wrapper so callers never touch JSON.parse/stringify directly. */
export const kvStorage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export const STORAGE_KEYS = {
  alarms: "wake-ai/alarms",
  events: "wake-ai/events",
  settings: "wake-ai/settings",
  customPersonalities: "wake-ai/custom-personalities",
  customSounds: "wake-ai/custom-sounds",
  userProfile: "wake-ai/user-profile",
} as const;
