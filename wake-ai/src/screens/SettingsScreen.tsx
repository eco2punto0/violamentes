import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWakeAIStore } from "@/state/store";
import { ExpoAlarmScheduler } from "@/core/alarm/alarmScheduler";
import GlowButton from "@/components/GlowButton";
import { theme } from "@/theme";

const scheduler = new ExpoAlarmScheduler();

export default function SettingsScreen() {
  const { settings, updateSettings } = useWakeAIStore();
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.anthropicApiKey ?? "");
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Row label="Vibración" description="Vibrar en niveles de intensidad altos.">
          <Switch value={settings.hapticsEnabled} onValueChange={(v) => updateSettings({ hapticsEnabled: v })} />
        </Row>
        <Row label="Volumen progresivo" description="Empezar suave y subir el volumen del sonido con el tiempo.">
          <Switch value={settings.progressiveVolume} onValueChange={(v) => updateSettings({ progressiveVolume: v })} />
        </Row>

        <Text style={styles.sectionTitle}>Inteligencia artificial</Text>
        <Row label="Usar LLM real (Anthropic)" description="Si está apagado, WAKE AI usa su motor de frases offline (funciona siempre, sin costo ni conexión).">
          <Switch value={settings.useLLM} onValueChange={(v) => updateSettings({ useLLM: v })} />
        </Row>
        {settings.useLLM && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Clave de API de Anthropic</Text>
            <TextInput
              style={styles.input}
              value={apiKeyDraft}
              onChangeText={setApiKeyDraft}
              placeholder="sk-ant-..."
              placeholderTextColor={theme.colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
            />
            <GlowButton
              label="Guardar clave"
              variant="outline"
              onPress={() => updateSettings({ anthropicApiKey: apiKeyDraft.trim() || undefined })}
              style={{ marginTop: 10 }}
            />
            <Text style={styles.note}>
              La clave se guarda solo en este dispositivo (AsyncStorage) y se usa para llamar directamente a
              api.anthropic.com desde la app. Nunca se envía a ningún otro servidor.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Permisos</Text>
        <GlowButton
          label="Solicitar permiso de notificaciones"
          variant="outline"
          onPress={async () => {
            const granted = await scheduler.requestPermissions();
            setPermissionStatus(granted ? "Concedido ✓" : "Denegado — las alarmas no podrán sonar.");
          }}
        />
        {permissionStatus && <Text style={styles.note}>{permissionStatus}</Text>}

        <Text style={styles.sectionTitle}>Sobre las limitaciones</Text>
        <Text style={styles.note}>
          El reconocimiento de voz nativo requiere una build de desarrollo (no funciona en Expo Go). El disparo
          exacto de la alarma en segundo plano depende de las políticas de batería del sistema operativo. Ver
          README.md del proyecto para el detalle completo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: { color: theme.colors.textMuted, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 28, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 10 },
  rowLabel: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  rowDescription: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  label: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 8 },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 14, color: theme.colors.text, fontSize: 15 },
  note: { color: theme.colors.textFaint, fontSize: 12, marginTop: 10, lineHeight: 18 },
});
