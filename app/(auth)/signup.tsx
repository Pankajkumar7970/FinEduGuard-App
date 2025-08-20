import React from "react";
import { View, StyleSheet, Text, Image, Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import SignupForm from "../../components/SignupForm";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function SignupScreen() {
  const handleSignupSuccess = () => {
    router.push("/(auth)/OTPVerification");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Form Container */}
      <View style={styles.formContainer}>
        <SignupForm onSignupSuccess={handleSignupSuccess} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1b8a5a", // Same rich green as LoginScreen
  },
  header: {
    alignItems: "center",
  },
  logo: {
    width: width * 0.8,
    height: width * 0.4,
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 16,
    color: "#f1d28f", // Gold tone for elegance
    fontWeight: "500",
  },
  formContainer: {
    flex: 1,
  },
});
