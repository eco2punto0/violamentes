import { useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useWakeAIStore } from "@/state/store";
import AlarmCard from "@/components/AlarmCard";
import GlowButton from "@/components/GlowButton";
import { theme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { alarms, hydrated, hydrate, toggleAlarm } = useWakeAIStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>WAKE AI</Text>
          <Text style={styles.subtitle}>“No te despierta. Se asegura de que te levantes.”</Text>
        </View>
      </View>

      <View style={styles.navRow}>
        <GlowButton label="Estadísticas" variant="outline" onPress={() => navigation.navigate("Dashboard")} style={styles.navBtn} />
        <GlowButton label="Ajustes" variant="outline" onPress={() => navigation.navigate("Settings")} style={styles.navBtn} />
      </View>

      <FlatList
        data={[...alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Todavía no tenés alarmas. Creá la primera.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            onPress={() => navigation.navigate("AlarmForm", { alarm: item })}
            onToggle={(enabled) => toggleAlarm(item.id, enabled)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <GlowButton label="CREAR ALARMA" onPress={() => navigation.navigate("AlarmForm")} style={styles.cta} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 20 },
  headerRow: { marginTop: 12, marginBottom: 4 },
  title: { color: theme.colors.text, fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, fontStyle: "italic" },
  navRow: { flexDirection: "row", gap: 10, marginVertical: 16 },
  navBtn: { flex: 1, paddingVertical: 12 },
  list: { paddingBottom: 12 },
  empty: { paddingVertical: 60, alignItems: "center" },
  emptyText: { color: theme.colors.textMuted, textAlign: "center" },
  cta: { marginTop: 12, marginBottom: 8 },
});
