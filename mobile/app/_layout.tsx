import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerForPush } from "@/notifications";
import { theme } from "@/theme";

export default function RootLayout() {
  useEffect(() => {
    // Ask for notification permission + register for pushes on first launch.
    registerForPush();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="badge/[set]" options={{ title: "Badge" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
