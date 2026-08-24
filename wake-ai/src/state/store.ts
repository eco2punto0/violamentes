import { create } from "zustand";
import { ExpoAlarmScheduler } from "@/core/alarm/alarmScheduler";
import { kvStorage, STORAGE_KEYS } from "@/core/storage/kvStorage";
import type { Alarm, AppSettings, PersonalityProfile, SoundAsset } from "@/types";

const scheduler = new ExpoAlarmScheduler();

interface WakeAIStore {
  alarms: Alarm[];
  settings: AppSettings;
  customPersonalities: PersonalityProfile[];
  customSounds: SoundAsset[];
  hydrated: boolean;

  hydrate: () => Promise<void>;
  createAlarm: (alarm: Alarm) => Promise<void>;
  updateAlarm: (alarm: Alarm) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  toggleAlarm: (id: string, enabled: boolean) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  addCustomPersonality: (p: PersonalityProfile) => Promise<void>;
  addCustomSound: (s: SoundAsset) => Promise<void>;
}

const defaultSettings: AppSettings = {
  useLLM: false,
  hapticsEnabled: true,
  progressiveVolume: true,
};

export const useWakeAIStore = create<WakeAIStore>((set, get) => ({
  alarms: [],
  settings: defaultSettings,
  customPersonalities: [],
  customSounds: [],
  hydrated: false,

  hydrate: async () => {
    const [alarms, settings, customPersonalities, customSounds] = await Promise.all([
      kvStorage.get<Alarm[]>(STORAGE_KEYS.alarms, []),
      kvStorage.get<AppSettings>(STORAGE_KEYS.settings, defaultSettings),
      kvStorage.get<PersonalityProfile[]>(STORAGE_KEYS.customPersonalities, []),
      kvStorage.get<SoundAsset[]>(STORAGE_KEYS.customSounds, []),
    ]);
    set({ alarms, settings, customPersonalities, customSounds, hydrated: true });
    await Promise.all(alarms.filter((a) => a.enabled).map((a) => scheduler.schedule(a)));
  },

  createAlarm: async (alarm) => {
    const alarms = [...get().alarms, alarm];
    set({ alarms });
    await kvStorage.set(STORAGE_KEYS.alarms, alarms);
    await scheduler.schedule(alarm);
  },

  updateAlarm: async (alarm) => {
    const alarms = get().alarms.map((a) => (a.id === alarm.id ? alarm : a));
    set({ alarms });
    await kvStorage.set(STORAGE_KEYS.alarms, alarms);
    await scheduler.schedule(alarm);
  },

  deleteAlarm: async (id) => {
    const alarms = get().alarms.filter((a) => a.id !== id);
    set({ alarms });
    await kvStorage.set(STORAGE_KEYS.alarms, alarms);
    await scheduler.cancel(id);
  },

  toggleAlarm: async (id, enabled) => {
    const alarm = get().alarms.find((a) => a.id === id);
    if (!alarm) return;
    const updated = { ...alarm, enabled, updatedAt: Date.now() };
    await get().updateAlarm(updated);
  },

  updateSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await kvStorage.set(STORAGE_KEYS.settings, settings);
  },

  addCustomPersonality: async (p) => {
    const customPersonalities = [p, ...get().customPersonalities.filter((existing) => existing.id !== p.id || !existing.isCustom)];
    set({ customPersonalities });
    await kvStorage.set(STORAGE_KEYS.customPersonalities, customPersonalities);
  },

  addCustomSound: async (s) => {
    const customSounds = [...get().customSounds, s];
    set({ customSounds });
    await kvStorage.set(STORAGE_KEYS.customSounds, customSounds);
  },
}));
