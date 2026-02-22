import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Save token to Supabase profile so the server can reach this device
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', user.id);
  }

  return token;
}

// Send a local notification (no server needed — fires on this device only)
export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds = 0,
) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: delaySeconds > 0 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds } : null,
  });
}

// Notify the comedian when they're 2 spots away from performing
export async function notifyComingSoon(venueName: string, spotsAhead: number) {
  if (spotsAhead === 2) {
    await scheduleLocalNotification(
      "You're almost up! 🎤",
      `2 more comics at ${venueName} — get ready!`,
    );
  } else if (spotsAhead === 1) {
    await scheduleLocalNotification(
      "You're next! 🎤",
      `One more comic at ${venueName} — head to the stage!`,
    );
  }
}

// Notify when someone gives feedback on a set
export async function notifyFeedbackReceived(commenterName: string) {
  await scheduleLocalNotification(
    'New feedback on your set',
    `${commenterName} left you a critique — check it out!`,
  );
}
