import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useWakeAIStore } from "@/state/store";
import PersonalityPicker from "@/components/PersonalityPicker";
import IntensitySlider from "@/components/IntensitySlider";
import ModeSelector from "@/components/ModeSelector";
import GlowButton from "@/components/GlowButton";
import { theme } from "@/theme";
import { dayName } from "@/core/stats/statsEngine";
import { BUILTIN_SOUND_CATALOG } from "@/core/audio/soundLibrary";
import type { Alarm, AlarmMode, IntensityLevel, PersonalityId, RepeatDay } from "@/types";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmForm">;

const ALL_DAYS: RepeatDay[] = [1, 2, 3, 4, 5, 0, 6];

function newId() {
  return `alarm_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

export default function AlarmFormScreen({ navigation, route }: Props) {
  const existing = route.params?.alarm;
  const { createAlarm, updateAlarm, deleteAlarm, customPersonalities, customSounds } = useWakeAIStore();

  const [time, setTime] = useState(() => {
    const d = new Date();
    if (existing) {
      d.setHours(existing.hour, existing.minute);
    } else {
      d.setHours(7, 0);
    }
    return d;
  });
  const [days, setDays] = useState<RepeatDay[]>(existing?.days ?? [1, 2, 3, 4, 5]);
  const [personalityId, setPersonalityId] = useState<PersonalityId>(existing?.personalityId ?? "coach");
  const [startingIntensity, setStartingIntensity] = useState<IntensityLevel>(existing?.startingIntensity ?? 3);
  const [maxIntensity, setMaxIntensity] = useState<IntensityLevel>(existing?.maxIntensity ?? 8);
  const [mode, setMode] = useState<AlarmMode>(existing?.mode ?? "normal");
  const [soundId, setSoundId] = useState(existing?.soundId ?? BUILTIN_SOUND_CATALOG[0].id);
  const [personalGoal, setPersonalGoal] = useState(existing?.personalGoal ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");

  function toggleDay(day: RepeatDay) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSave() {
    const alarm: Alarm = {
      id: existing?.id ?? newId(),
      label: label || undefined,
      hour: time.getHours(),
      minute: time.getMinutes(),
      days,
      personalityId,
      startingIntensity,
      maxIntensity: mode === "extremo" ? 10 : maxIntensity,
      soundId,
      mode,
      personalGoal: personalGoal || undefined,
      enabled: true,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    if (existing) {
      await updateAlarm(alarm);
    } else {
      await createAlarm(alarm);
    }
    navigation.goBack();
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert("Eliminar alarma", "¿Seguro que querés eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => { await deleteAlarm(existing.id); navigation.goBack(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.question}>¿A qué hora querés levantarte?</Text>
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={time}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_, selected) => selected && setTime(selected)}
            style={styles.picker}
          />
        </View>

        <Text style={styles.sectionLabel}>Días</Text>
        <View style={styles.daysRow}>
          {ALL_DAYS.map((d) => (
            <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.dayChip, days.includes(d) && styles.dayChipSelected]}>
              <Text style={[styles.dayChipText, days.includes(d) && styles.dayChipTextSelected]}>{dayName(d).slice(0, 3)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Personalidad</Text>
        <PersonalityPicker
          value={personalityId}
          onChange={setPersonalityId}
          customPersonalities={customPersonalities}
          onCreateCustom={() => navigation.navigate("CustomPersonality")}
        />

        <Text style={styles.sectionLabel}>Intensidad</Text>
        <IntensitySlider label="Intensidad inicial" value={startingIntensity} onChange={setStartingIntensity} />
        {mode !== "extremo" && (
          <View style={{ marginTop: 16 }}>
            <IntensitySlider label="Intensidad máxima" value={maxIntensity} onChange={setMaxIntensity} />
          </View>
        )}

        <Text style={styles.sectionLabel}>Sonido</Text>
        <Pressable style={styles.soundRow} onPress={() => navigation.navigate("SoundLibrary", { onSelect: setSoundId })}>
          <Text style={styles.soundText}>
            {[...BUILTIN_SOUND_CATALOG, ...customSounds].find((s) => s.id === soundId)?.name ?? "Elegir sonido"}
          </Text>
          <Text style={styles.soundChevron}>›</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Modo</Text>
        <ModeSelector value={mode} onChange={setMode} />

        <Text style={styles.sectionLabel}>Objetivo personal (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: entrenar antes del trabajo"
          placeholderTextColor={theme.colors.textFaint}
          value={personalGoal}
          onChangeText={setPersonalGoal}
        />

        <Text style={styles.sectionLabel}>Nombre (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Alarma laboral"
          placeholderTextColor={theme.colors.textFaint}
          value={label}
          onChangeText={setLabel}
        />

        <GlowButton label={existing ? "GUARDAR CAMBIOS" : "CREAR ALARMA"} onPress={handleSave} style={{ marginTop: 28 }} />
        {existing && <GlowButton label="Eliminar alarma" variant="ghost" onPress={handleDelete} style={{ marginTop: 12 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48 },
  question: { color: theme.colors.text, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  pickerWrap: { alignItems: "center", marginVertical: 8 },
  picker: { height: 160 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 10 },
  daysRow: { flexDirection: "row", gap: 8 },
  dayChip: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  dayChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayChipText: { color: theme.colors.textMuted, fontWeight: "700", fontSize: 12 },
  dayChipTextSelected: { color: "#0A0A12" },
  soundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  soundText: { color: theme.colors.text, fontSize: 15 },
  soundChevron: { color: theme.colors.textMuted, fontSize: 20 },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 14, color: theme.colors.text, fontSize: 15 },
});
