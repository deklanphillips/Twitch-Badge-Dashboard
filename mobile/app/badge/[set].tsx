import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BadgeSet, DropEvent, badgeImage, badgePageUrl, fetchBadges, fetchEvents, statusOf } from "@/api";
import { cancelEndReminder, scheduleEndReminder } from "@/notifications";
import { getWanted, setWanted } from "@/tracker";
import { statusColor, theme } from "@/theme";

const fmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function BadgeDetail() {
  const { set } = useLocalSearchParams<{ set: string }>();
  const navigation = useNavigation();
  const [badge, setBadge] = useState<BadgeSet | undefined>();
  const [event, setEvent] = useState<DropEvent | undefined>();
  const [wanted, setWantedState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [badges, events, want] = await Promise.all([fetchBadges(), fetchEvents(), getWanted()]);
        const b = badges.find((x) => x.set_id === set);
        const ev = events.find((x) => x.badge.set === set);
        setBadge(b);
        setEvent(ev);
        setWantedState(want.has(set as string));
        navigation.setOptions({ title: ev?.name ?? b?.versions[0]?.title ?? "Badge" });
      } finally {
        setLoading(false);
      }
    })();
  }, [set, navigation]);

  const onToggle = async () => {
    const next = !wanted;
    const updated = await setWanted(set as string, next);
    setWantedState(updated.has(set as string));
    if (next && event) await scheduleEndReminder(event);
    else await cancelEndReminder(set as string);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.purple} />
      </View>
    );
  }

  const img = badgeImage(badge, event?.badge.version);
  const status = event ? statusOf(event) : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, alignItems: "center" }}>
      {img ? <Image source={{ uri: img }} style={styles.hero} /> : <View style={[styles.hero, styles.ph]} />}
      <Text style={styles.title}>{event?.name ?? badge?.versions[0]?.title ?? set}</Text>
      {status && <Text style={[styles.status, { color: statusColor[status] }]}>{status.toUpperCase()}</Text>}

      {event?.description ? <Text style={styles.desc}>{event.description}</Text> : null}

      <View style={styles.card}>
        {event?.requirement ? <Row label="How to earn" value={event.requirement} /> : null}
        {event?.channel ? <Row label="Category" value={event.channel} /> : null}
        {event?.start ? <Row label="Starts" value={fmt.format(new Date(event.start))} /> : null}
        <Row label="Ends" value={event?.end ? fmt.format(new Date(event.end)) : "Ongoing"} />
      </View>

      <Pressable style={[styles.btn, wanted ? styles.btnOn : styles.btnOff]} onPress={onToggle}>
        <Text style={styles.btnText}>{wanted ? "⭐ Tracking — tap to remove" : "☆ Track this drop"}</Text>
      </Pressable>

      {event && (
        <Pressable style={styles.link} onPress={() => Linking.openURL(badgePageUrl(event))}>
          <Text style={styles.linkText}>Open on badgedrops.com →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowLine}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  hero: { width: 96, height: 96, borderRadius: 16, marginBottom: 12 },
  ph: { backgroundColor: theme.cardAlt },
  title: { color: theme.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  status: { fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 4 },
  desc: { color: theme.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 12 },
  card: {
    alignSelf: "stretch",
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginTop: 18,
    gap: 10,
  },
  rowLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: theme.muted, fontSize: 13 },
  rowValue: { color: theme.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  btn: { alignSelf: "stretch", borderRadius: 12, padding: 14, marginTop: 18, alignItems: "center" },
  btnOn: { backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.purple },
  btnOff: { backgroundColor: theme.purple },
  btnText: { color: theme.text, fontWeight: "700" },
  link: { marginTop: 16 },
  linkText: { color: theme.purple, fontWeight: "600" },
});
