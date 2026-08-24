import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Alarm } from "@/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface IAlarmScheduler {
  requestPermissions(): Promise<boolean>;
  schedule(alarm: Alarm): Promise<void>;
  cancel(alarmId: string): Promise<void>;
  cancelAll(): Promise<void>;
}

/**
 * LIMITATION (spec §17, documented instead of hidden): expo-notifications
 * gives us reliable *local* scheduled notifications, which is enough to wake
 * the OS and bring the user's attention at the right time — including when
 * the app is backgrounded or the device is locked. What it can NOT do on a
 * stock Expo/Expo Go setup is:
 *   - Guarantee millisecond-exact firing on Android/iOS when the OS applies
 *     aggressive battery/Doze optimizations (both platforms can delay a
 *     local notification by up to a few minutes in the worst case).
 *   - Launch a full custom looping alarm UI over the lock screen the way a
 *     native AlarmManager (Android) / critical alert (iOS, needs a special
 *     Apple entitlement) app can.
 * For a production-grade "never fails to fire" alarm, this scheduler is
 * designed to be swapped for a native module (e.g. via a config plugin
 * wrapping AlarmManager + notifee) behind the same IAlarmScheduler
 * interface — nothing above this layer would need to change.
 */
export class ExpoAlarmScheduler implements IAlarmScheduler {
  async requestPermissions(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return status === "granted";
  }

  async schedule(alarm: Alarm): Promise<void> {
    await this.cancel(alarm.id);
    if (!alarm.enabled) return;

    const content: Notifications.NotificationContentInput = {
      title: "WAKE AI",
      body: alarm.label ?? "Es hora de levantarte.",
      sound: Platform.OS === "ios" ? "default" : "default",
      data: { alarmId: alarm.id, kind: "wake-ai-alarm" },
      categoryIdentifier: "wake-ai-alarm",
    };

    if (alarm.days.length === 0) {
      const trigger = nextOneShotDate(alarm.hour, alarm.minute);
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
        identifier: alarm.id,
      });
      return;
    }

    // One repeating weekly trigger per selected day (expo-notifications
    // schedules per-weekday, not a multi-day set in one call).
    await Promise.all(
      alarm.days.map((day) =>
        Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1, // expo-notifications: 1 = Sunday
            hour: alarm.hour,
            minute: alarm.minute,
          },
          identifier: `${alarm.id}_day${day}`,
        })
      )
    );
  }

  async cancel(alarmId: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter((n) => n.identifier === alarmId || n.identifier.startsWith(`${alarmId}_day`));
    await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

function nextOneShotDate(hour: number, minute: number): Date {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

export async function registerAlarmNotificationCategory() {
  await Notifications.setNotificationCategoryAsync("wake-ai-alarm", [
    { identifier: "SNOOZE", buttonTitle: "Posponer" },
    { identifier: "IM_AWAKE", buttonTitle: "Estoy despierto" },
  ]);
}
