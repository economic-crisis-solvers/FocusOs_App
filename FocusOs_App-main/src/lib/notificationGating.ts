import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type QueueItem = {
  id: string;
  app: string;
  body: string;
  receivedAt: number;
};

let isGating = false;

export function getIsGating() { return isGating; }

export async function activateGating() {
  isGating = true;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export async function releaseNotificationQueue() {
  isGating = false;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  const raw = await AsyncStorage.getItem('notif_queue');
  const queue: QueueItem[] = raw ? JSON.parse(raw) : [];

  if (queue.length === 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `FocusOS: ${queue.length} notifications held`,
      body: 'Tap to see what you missed while in deep focus',
      data: { type: 'queue_release', count: queue.length },
    },
    trigger: null,
  });

  await AsyncStorage.removeItem('notif_queue');
}

/** Silent release — clears the queue without haptics or a burst notification. */
export async function releaseNotificationQueueQuiet() {
  isGating = false;
  await AsyncStorage.removeItem('notif_queue');
}

export async function addToQueue(notification: Notifications.Notification) {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const raw = await AsyncStorage.getItem('notif_queue');
  const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
  queue.push({
    id: notification.request.identifier,
    app: notification.request.content.title ?? 'Unknown',
    body: notification.request.content.body ?? '',
    receivedAt: Date.now(),
  });
  await AsyncStorage.setItem('notif_queue', JSON.stringify(queue));
}

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      if (isGating) {
        await addToQueue(notification);
        return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false };
      }
      return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true };
    },
  });
}