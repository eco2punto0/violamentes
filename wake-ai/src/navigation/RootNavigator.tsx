import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Alarm } from "@/types";
import { theme } from "@/theme";

import HomeScreen from "@/screens/HomeScreen";
import AlarmFormScreen from "@/screens/AlarmFormScreen";
import ActiveAlarmScreen from "@/screens/ActiveAlarmScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import SoundLibraryScreen from "@/screens/SoundLibraryScreen";
import CustomPersonalityScreen from "@/screens/CustomPersonalityScreen";
import SettingsScreen from "@/screens/SettingsScreen";

export type RootStackParamList = {
  Home: undefined;
  AlarmForm: { alarm?: Alarm } | undefined;
  ActiveAlarm: { alarmId: string };
  Dashboard: undefined;
  SoundLibrary: { onSelect?: (soundId: string) => void } | undefined;
  CustomPersonality: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToActiveAlarm(alarmId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate("ActiveAlarm", { alarmId });
  }
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.primary,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "WAKE AI" }} />
        <Stack.Screen name="AlarmForm" component={AlarmFormScreen} options={{ title: "Nueva alarma" }} />
        <Stack.Screen
          name="ActiveAlarm"
          component={ActiveAlarmScreen}
          options={{ headerShown: false, gestureEnabled: false, animation: "fade" }}
        />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Estadísticas" }} />
        <Stack.Screen name="SoundLibrary" component={SoundLibraryScreen} options={{ title: "Biblioteca de sonidos" }} />
        <Stack.Screen name="CustomPersonality" component={CustomPersonalityScreen} options={{ title: "Personalidad propia" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Ajustes" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
