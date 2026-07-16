import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeSet, badgeImage, fetchBadges } from "@/api";
import { theme } from "@/theme";

export default function BadgesScreen() {
  const router = useRouter();
  const [badges, setBadges] = useState<BadgeSet[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBadges(await fetchBadges());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? badges.filter((b) => `${b.set_id} ${b.versions[0]?.title ?? ""}`.toLowerCase().includes(q))
      : badges;
    return list;
  }, [badges, query]);

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
        placeholder="Search badges…"
        placeholderTextColor={theme.muted}
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filtered}
        numColumns={3}
        keyExtractor={(b) => b.set_id}
        renderItem={({ item }) => {
          const img = badgeImage(item);
          return (
            <Pressable
              style={styles.tile}
              onPress={() => router.push(`/badge/${encodeURIComponent(item.set_id)}`)}
            >
              {img ? <Image source={{ uri: img }} style={styles.img} /> : <View style={styles.img} />}
              <Text style={styles.label} numberOfLines={2}>
                {item.versions[0]?.title ?? item.set_id}
              </Text>
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tile: { flex: 1 / 3, alignItems: "center", padding: 10, gap: 6 },
  img: { width: 48, height: 48, borderRadius: 8, backgroundColor: theme.cardAlt },
  label: { color: theme.muted, fontSize: 11, textAlign: "center" },
});
