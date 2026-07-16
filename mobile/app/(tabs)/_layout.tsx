import { Tabs } from "expo-router";
import { Text } from "react-native";
import { theme } from "@/theme";

function icon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.purple,
        tabBarInactiveTintColor: theme.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Events", tabBarIcon: icon("📅") }} />
      <Tabs.Screen name="badges" options={{ title: "Badges", tabBarIcon: icon("⚡") }} />
      <Tabs.Screen name="emotes" options={{ title: "Emotes", tabBarIcon: icon("😀") }} />
      <Tabs.Screen name="tracker" options={{ title: "Tracker", tabBarIcon: icon("⭐") }} />
    </Tabs>
  );
}
