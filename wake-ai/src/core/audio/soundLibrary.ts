import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import type { SoundAsset, SoundCategory } from "@/types";

/**
 * Built-in catalogue metadata. NOTE (spec §17 honesty rule): we do not bundle
 * copyrighted third-party music with the app. Each entry's `source` points to
 * a bundled placeholder tone (see assets/sounds/README.md for how to drop in
 * real royalty-free files before shipping) OR, until you do, `source` is left
 * undefined and the UI marks the entry as "necesita archivo" — it never
 * silently pretends to play something that isn't there.
 */
export const SOUND_CATEGORIES: SoundCategory[] = [
  "Relax",
  "Energía",
  "Electrónica",
  "Rock",
  "Naturaleza",
  "Caos",
  "Comedia",
  "Emergencia",
];

interface SoundCatalogEntry {
  id: string;
  name: string;
  category: SoundCategory;
  /** Relative path under assets/sounds the developer is expected to fill in. */
  expectedAssetPath: string;
}

export const BUILTIN_SOUND_CATALOG: SoundCatalogEntry[] = [
  { id: "relax-piano", name: "Piano suave", category: "Relax", expectedAssetPath: "relax/piano.mp3" },
  { id: "relax-lofi", name: "Lo-fi calma", category: "Relax", expectedAssetPath: "relax/lofi.mp3" },
  { id: "energia-beat", name: "Beat motivador", category: "Energía", expectedAssetPath: "energia/beat.mp3" },
  { id: "electronica-synth", name: "Synth ascendente", category: "Electrónica", expectedAssetPath: "electronica/synth.mp3" },
  { id: "rock-riff", name: "Riff de guitarra", category: "Rock", expectedAssetPath: "rock/riff.mp3" },
  { id: "naturaleza-pajaros", name: "Pájaros al amanecer", category: "Naturaleza", expectedAssetPath: "naturaleza/pajaros.mp3" },
  { id: "caos-alarma", name: "Caos total", category: "Caos", expectedAssetPath: "caos/alarma.mp3" },
  { id: "comedia-kazoo", name: "Kazoo absurdo", category: "Comedia", expectedAssetPath: "comedia/kazoo.mp3" },
  { id: "emergencia-sirena", name: "Sirena de emergencia", category: "Emergencia", expectedAssetPath: "emergencia/sirena.mp3" },
];

const CUSTOM_SOUNDS_DIR = `${FileSystem.documentDirectory ?? ""}wake-ai-sounds/`;

async function ensureCustomDir() {
  const info = await FileSystem.getInfoAsync(CUSTOM_SOUNDS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CUSTOM_SOUNDS_DIR, { intermediates: true });
  }
}

/** Real file import flow: pick an audio file, copy it into app storage, return a persistent SoundAsset. */
export async function importCustomSound(displayName: string): Promise<SoundAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const picked = result.assets[0];
  await ensureCustomDir();
  const destination = `${CUSTOM_SOUNDS_DIR}${Date.now()}_${picked.name}`;
  await FileSystem.copyAsync({ from: picked.uri, to: destination });

  return {
    id: `custom_${Date.now()}`,
    name: displayName || picked.name,
    category: "Caos",
    source: destination,
    isCustom: true,
  };
}

/**
 * Unifies the builtin catalog (no playable file yet, by design — see the
 * note above) with user-imported custom sounds (always playable, real
 * file:// URI) into a single lookup the alarm player can use without caring
 * which kind it got.
 */
export function resolveSoundSource(soundId: string, customSounds: SoundAsset[]): string | undefined {
  const custom = customSounds.find((s) => s.id === soundId);
  if (custom && typeof custom.source === "string") return custom.source;
  return undefined; // builtin catalog entries have no bundled file until assets/sounds/*.mp3 are added
}

export async function listCustomSounds(saved: SoundAsset[]): Promise<SoundAsset[]> {
  // Filters out entries whose backing file was removed from disk (e.g. app reinstall).
  const checks = await Promise.all(
    saved.map(async (s) => {
      if (typeof s.source !== "string") return s;
      const info = await FileSystem.getInfoAsync(s.source);
      return info.exists ? s : null;
    })
  );
  return checks.filter((s): s is SoundAsset => !!s);
}
