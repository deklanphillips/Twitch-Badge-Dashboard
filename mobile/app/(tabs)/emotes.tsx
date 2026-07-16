import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { Emote, fetchEmotes } from "@/api";
import { theme } from "@/theme";

export default function EmotesScreen() {
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setEmotes(await fetchEmotes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? emotes.filter((e) => e.name.toLowerCase().includes(q)) : emotes;
  }, [emotes, query]);

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
        placeholder="Search emotes…"
        placeholderTextColor={theme.muted}
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filtered}
        numColumns={4}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => {
          const img = item.images?.url_4x ?? item.images?.url_2x ?? item.images?.url_1x;
          return (
            <View style={styles.tile}>
              {img ? <Image source={{ uri: img }} style={styles.img} /> : <View style={styles.img} />}
              <Text style={styles.label} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
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
  tile: { flex: 1 / 4, alignItems: "center", padding: 8, gap: 4 },
  img: { width: 40, height: 40 },
  label: { color: theme.muted, fontSize: 10, textAlign: "center" },
});
