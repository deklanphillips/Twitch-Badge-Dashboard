import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeSet, DropEvent, fetchBadges, fetchEvents, sortEvents } from "@/api";
import { EventRow } from "@/components/EventRow";
import { syncReminders } from "@/notifications";
import { getWanted, setWanted } from "@/tracker";
import { theme } from "@/theme";

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<DropEvent[]>([]);
  const [badges, setBadges] = useState<Map<string, BadgeSet>>(new Map());
  const [wanted, setWantedState] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [evs, bs, want] = await Promise.all([fetchEvents(), fetchBadges(), getWanted()]);
      const sorted = sortEvents(evs);
      setEvents(sorted);
      setBadges(new Map(bs.map((b) => [b.set_id, b])));
      setWantedState(want);
      syncReminders(sorted, want);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onToggle = useCallback(async (ev: DropEvent, next: boolean) => {
    const updated = await setWanted(ev.badge.set, next);
    setWantedState(new Set(updated));
    const { scheduleEndReminder, cancelEndReminder } = await import("@/notifications");
    if (next) await scheduleEndReminder(ev);
    else await cancelEndReminder(ev.badge.set);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => `${e.name} ${e.channel ?? ""} ${e.requirement ?? ""}`.toLowerCase().includes(q));
  }, [events, query]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.purple} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search drops…"
        placeholderTextColor={theme.muted}
        value={query}
        onChangeText={setQuery}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(e) => `${e.group ?? e.badge.set}-${e.badge.version}`}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            badge={badges.get(item.badge.set)}
            wanted={wanted.has(item.badge.set)}
            onToggleWant={onToggle}
            onPress={(ev) => router.push(`/badge/${encodeURIComponent(ev.badge.set)}`)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.purple}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>No drops match your search.</Text>}
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  search: {
    backgroundColor: theme.card,
    color: theme.text,
    margin: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  error: { color: theme.orange, textAlign: "center", padding: 8 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 40 },
});
