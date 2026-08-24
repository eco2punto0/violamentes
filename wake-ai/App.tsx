import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

import RootNavigator, { navigateToActiveAlarm } from "@/navigation/RootNavigator";
import { ExpoAlarmScheduler, registerAlarmNotificationCategory } from "@/core/alarm/alarmScheduler";
import { useWakeAIStore } from "@/state/store";
import { theme } from "@/theme";

const scheduler = new ExpoAlarmScheduler();

export default function App() {
  const hydrate = useWakeAIStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    scheduler.requestPermissions();
    registerAlarmNotificationCategory();

    // Tapping the notification (or its "Estoy despierto"/"Posponer" actions)
    // opens the immersive conversation screen for that specific alarm.
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const alarmId = response.notification.request.content.data?.alarmId as string | undefined;
      const baseAlarmId = alarmId?.split("_day")[0];
      if (baseAlarmId) navigateToActiveAlarm(baseAlarmId);
    });

    // If the app is already in the foreground when the scheduled time hits,
    // jump straight into the conversation instead of waiting for a tap.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const alarmId = notification.request.content.data?.alarmId as string | undefined;
      const baseAlarmId = alarmId?.split("_day")[0];
      if (baseAlarmId) navigateToActiveAlarm(baseAlarmId);
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style="light" />
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
