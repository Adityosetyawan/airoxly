import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { theme } from "@/src/theme";

export function LoadingScreen() {
  return (
    <View style={styles.wrap} testID="loading-screen">
      <ActivityIndicator size="large" color={theme.color.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
