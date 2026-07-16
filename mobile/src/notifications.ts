// Notifications for the BadgeDrops app.
//
// Two independent paths:
//
//  1. LOCAL reminders (works today, no backend): when a user stars a badge we
//     schedule an on-device notification a set time before it ends. Fully
//     offline; the OS fires it even if the app is closed.
//
//  2. REMOTE "new badge" push (needs the server side wired once): every device
//     registers for pushes and subscribes to a single topic. The existing
//     GitHub Action — which already detects new badges every 30 min — sends one
//     push to that topic. No per-user token storage, no database.
//     Until the Firebase project + Action step exist, registration is a no-op
//     beyond asking for permission, so the app still builds and runs.
//
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { DropEvent } from "./api";

// How long before a badge ends we remind the user (hours).
const REMIND_BEFORE_HOURS = 24;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (granted && Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Badge drops",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#9147ff",
    });
  }
  return granted;
}

// Deterministic notification id per badge so re-starring replaces, not stacks.
function reminderId(setId: string): string {
  return `remind-${setId}`;
}

// Schedule (or refresh) a local "ending soon" reminder for a starred badge.
export async function scheduleEndReminder(ev: DropEvent): Promise<void> {
  if (!ev.end) return; // open-ended drop — nothing to remind about
  const endMs = Date.parse(ev.end);
  if (isNaN(endMs)) return;
  const fireAt = endMs - REMIND_BEFORE_HOURS * 3600 * 1000;
  if (fireAt <= Date.now()) return; // already within the window / past

  const id = reminderId(ev.badge.set);
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `⏳ ${ev.name} ends soon`,
      body: ev.requirement ? `${ev.requirement} — before it's gone.` : "Last chance to earn this badge.",
      data: { set: ev.badge.set },
    },
    trigger: { date: new Date(fireAt) },
  });
}

export async function cancelEndReminder(setId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderId(setId)).catch(() => {});
}

// Re-sync all local reminders from the current wanted set (call on app launch
// and after data refresh, since end dates can change between snapshots).
export async function syncReminders(events: DropEvent[], wanted: Set<string>): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;
  const bySet = new Map(events.map((e) => [e.badge.set, e]));
  for (const setId of wanted) {
    const ev = bySet.get(setId);
    if (ev) await scheduleEndReminder(ev);
  }
}

// Register the device for remote "new badge" pushes. Returns the Expo push
// token (useful for testing via expo.dev/notifications). Topic subscription is
// wired once the Firebase project exists — see mobile/README.md.
export async function registerForPush(): Promise<string | null> {
  const ok = await ensurePermission();
  if (!ok) return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}
