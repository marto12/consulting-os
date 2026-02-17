import { Platform } from "react-native";

if (Platform.OS === "web") {
  require("../client/src/styles/index.css");
}

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="project/[id]" />
      <Stack.Screen name="agent/[key]" />
    </Stack>
  );
}

let WebApp: React.ComponentType | null = null;
let webQueryClient: any = null;

if (Platform.OS === "web") {
  WebApp = require("../client/src/App").default;
  webQueryClient = require("../client/src/lib/query-client").queryClient;
}

function WebLayout() {
  if (!WebApp || !webQueryClient) return null;
  return (
    <QueryClientProvider client={webQueryClient}>
      <WebApp />
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  if (Platform.OS === "web") {
    return <WebLayout />;
  }

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={require("@/lib/query-client").queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <RootLayoutNav />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
