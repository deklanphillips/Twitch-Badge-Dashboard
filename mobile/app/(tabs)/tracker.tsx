import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { BadgeSet, DropEvent, fetchBadges, fetchEvents, sortEvents, statusOf } from "@/api";
import { EventRow } from "@/components/EventRow";
import { cancelEndReminder, scheduleEndReminder } from "@/notifications";
import { getEarned, getWanted, setEarned, setWanted } from "@/tracker";
import { theme } from "@/theme";

export default function TrackerScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<DropEvent[]>([]);
  const [badges, setBadges] = useState<Map<string, BadgeSet>>(new Map());
  const [wanted, setWantedState] = useState<Set<string>>(new Set());
  const [earned, setEarnedState] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [evs, bs, want, earn] = await Promise.all([fetchEvents(), fetchBadges(), getWanted(), getEarned()]);
    setEvents(sortEvents(evs));
    setBadges(new Map(bs.map((b) => [b.set_id, b])));
    setWantedState(want);
    setEarnedState(earn);
  }, []);

  // Reload whenever the tab regains focus so stars set elsewhere show up.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const wantedEvents = events.filter((e) => wanted.has(e.badge.set));
  const active = wantedEvents.filter((e) => statusOf(e) !== "ended");
  const done = wantedEvents.filter((e) => statusOf(e) === "ended");

  const onToggleWant = useCallback(async (ev: DropEvent, next: boolean) => {
    const updated = await setWanted(ev.badge.set, next);
    setWantedState(new Set(updated));
    if (next) await scheduleEndReminder(ev);
    else await cancelEndReminder(ev.badge.set);
  }, []);

  const toggleEarned = useCallback(async (setId: string) => {
    const updated = await setEarned(setId, !earned.has(setId));
    setEarnedState(new Set(updated));
  }, [earned]);

  if (wantedEvents.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No tracked drops yet</Text>
        <Text style={styles.emptyBody}>
          Tap the ☆ on any event to track it. You'll get a reminder before it ends.
        </Text>
      </View>
    );
  }

  const sections = [
    { title: "Active", data: active },
    { title: "Ended", data: done },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(e) => e.badge.set}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View>
          <EventRow
            event={item}
            badge={badges.get(item.badge.set)}
            wanted
            onToggleWant={onToggleWant}
            onPress={(ev) => router.push(`/badge/${encodeURIComponent(ev.badge.set)}`)}
          />
          <Pressable style={styles.earnRow} onPress={() => toggleEarned(item.badge.set)}>
            <Text style={{ fontSize: 16 }}>{earned.has(item.badge.set) ? "✅" : "⬜"}</Text>
            <Text style={styles.earnText}>
              {earned.has(item.badge.set) ? "Earned" : "Mark as earned"}
            </Text>
          </Pressable>
        </View>
      )}
      contentContainerStyle={{ paddingVertical: 8 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: theme.bg },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyBody: { color: theme.muted, textAlign: "center", lineHeight: 20 },
  section: { color: theme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  earnRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 24, marginTop: -2, marginBottom: 6, paddingLeft: 4 },
  earnText: { color: theme.muted, fontSize: 12 },
});
