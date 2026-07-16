import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BadgeSet, DropEvent, badgeImage, statusOf } from "@/api";
import { statusColor, theme } from "@/theme";

const fmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function endLabel(ev: DropEvent): string {
  if (!ev.end) return "Ongoing";
  const end = Date.parse(ev.end);
  return isNaN(end) ? "Ongoing" : `Ends ${fmt.format(new Date(end))}`;
}

type Props = {
  event: DropEvent;
  badge?: BadgeSet;
  wanted?: boolean;
  onToggleWant?: (ev: DropEvent, next: boolean) => void;
  onPress?: (ev: DropEvent) => void;
};

function EventRowBase({ event, badge, wanted, onToggleWant, onPress }: Props) {
  const status = statusOf(event);
  const img = badgeImage(badge, event.badge.version);
  return (
    <Pressable style={styles.row} onPress={() => onPress?.(event)}>
      {img ? (
        <Image source={{ uri: img }} style={styles.badgeImg} />
      ) : (
        <View style={[styles.badgeImg, styles.placeholder]} />
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {event.requirement ?? "See badge page"}
        </Text>
        <View style={styles.tagRow}>
          <Text style={[styles.status, { color: statusColor[status] }]}>{status.toUpperCase()}</Text>
          <Text style={styles.end}>{endLabel(event)}</Text>
        </View>
      </View>
      {onToggleWant && (
        <Pressable hitSlop={10} onPress={() => onToggleWant(event, !wanted)} style={styles.star}>
          <Text style={{ fontSize: 22 }}>{wanted ? "⭐" : "☆"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 5,
    gap: 12,
  },
  badgeImg: { width: 44, height: 44, borderRadius: 8 },
  placeholder: { backgroundColor: theme.cardAlt },
  body: { flex: 1, gap: 2 },
  name: { color: theme.text, fontSize: 15, fontWeight: "700" },
  meta: { color: theme.muted, fontSize: 12 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  status: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  end: { color: theme.muted, fontSize: 11 },
  star: { paddingLeft: 4 },
});

export const EventRow = memo(EventRowBase);
