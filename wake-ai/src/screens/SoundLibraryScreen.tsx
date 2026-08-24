import { Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { BUILTIN_SOUND_CATALOG, SOUND_CATEGORIES, importCustomSound } from "@/core/audio/soundLibrary";
import { useWakeAIStore } from "@/state/store";
import GlowButton from "@/components/GlowButton";
import { theme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "SoundLibrary">;

export default function SoundLibraryScreen({ navigation, route }: Props) {
  const { customSounds, addCustomSound } = useWakeAIStore();

  const sections = SOUND_CATEGORIES.map((category) => ({
    title: category,
    data: [
      ...BUILTIN_SOUND_CATALOG.filter((s) => s.category === category),
      ...customSounds.filter((s) => s.category === category),
    ],
  })).filter((s) => s.data.length > 0);

  function select(id: string) {
    route.params?.onSelect?.(id);
    navigation.goBack();
  }

  async function handleImport() {
    try {
      const sound = await importCustomSound("Mi sonido");
      if (sound) await addCustomSound(sound);
    } catch (err) {
      Alert.alert("No se pudo importar", err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const isCustom = "isCustom" in item && item.isCustom;
          return (
            <Pressable style={styles.item} onPress={() => select(item.id)}>
              <Text style={styles.itemName}>{item.name}</Text>
              {isCustom ? (
                <Text style={styles.itemHintOk}>propio</Text>
              ) : (
                <Text style={styles.itemHint}>necesita archivo · ver assets/sounds/README.md</Text>
              )}
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <GlowButton label="Agregar sonido propio" onPress={handleImport} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  sectionTitle: { color: theme.colors.textMuted, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  item: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemName: { color: theme.colors.text, fontSize: 15 },
  itemHint: { color: theme.colors.textFaint, fontSize: 11 },
  itemHintOk: { color: theme.colors.accent, fontSize: 11, fontWeight: "700" },
  footer: { position: "absolute", left: 20, right: 20, bottom: 16 },
});
