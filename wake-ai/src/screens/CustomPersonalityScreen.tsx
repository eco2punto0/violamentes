import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useWakeAIStore } from "@/state/store";
import GlowButton from "@/components/GlowButton";
import { theme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CustomPersonality">;

export default function CustomPersonalityScreen({ navigation }: Props) {
  const { addCustomPersonality } = useWakeAIStore();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [tone, setTone] = useState("");
  const [pitch, setPitch] = useState("1.0");
  const [rate, setRate] = useState("1.0");

  async function handleSave() {
    if (!name.trim()) return;
    await addCustomPersonality({
      id: "custom",
      name: name.trim(),
      tagline: tagline.trim() || "Tu personalidad, tus reglas.",
      tone: tone.split(",").map((t) => t.trim()).filter(Boolean),
      voice: { pitch: clamp(parseFloat(pitch) || 1, 0.5, 2), rate: clamp(parseFloat(rate) || 1, 0.5, 2) },
      isCustom: true,
    });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Mi mamá" placeholderTextColor={theme.colors.textFaint} />

        <Text style={styles.label}>Descripción corta</Text>
        <TextInput style={styles.input} value={tagline} onChangeText={setTagline} placeholder="Ej: Cariñosa pero no da tregua" placeholderTextColor={theme.colors.textFaint} />

        <Text style={styles.label}>Palabras de tono (separadas por coma)</Text>
        <TextInput style={styles.input} value={tone} onChangeText={setTone} placeholder="cálida, insistente, graciosa" placeholderTextColor={theme.colors.textFaint} />

        <Text style={styles.label}>Tono de voz (0.5 grave — 2.0 agudo)</Text>
        <TextInput style={styles.input} value={pitch} onChangeText={setPitch} keyboardType="decimal-pad" />

        <Text style={styles.label}>Velocidad de habla (0.5 lenta — 2.0 rápida)</Text>
        <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />

        <Text style={styles.note}>
          Nota: sin una clave de IA (LLM) activada en Ajustes, esta personalidad usa el motor de frases del modo
          "Friend" con tu tono de voz aplicado. Con una clave de Anthropic activada, la IA genera diálogo propio
          respetando la descripción que escribiste acá.
        </Text>

        <GlowButton label="Guardar personalidad" onPress={handleSave} style={{ marginTop: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48 },
  label: { color: theme.colors.textMuted, fontSize: 13, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 14, color: theme.colors.text, fontSize: 15 },
  note: { color: theme.colors.textFaint, fontSize: 12, marginTop: 20, lineHeight: 18 },
});
