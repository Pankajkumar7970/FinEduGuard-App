// OAuthButtons.js
import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ToastAndroid,
} from "react-native";
import { signInWithGoogle } from "../utils/firebaseAuth"; // our auth helper
import { Ionicons } from "@expo/vector-icons";

const OAuthButtons = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const user = await signInWithGoogle();

      console.log("Google User Info:", user);

      // Send user info to backend
      // const response = await fetch(
      //   "https://yourapi.com/api/auth/google-login",
      //   {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify(user),
      //   }
      // );
      // const data = await response.json();

      ToastAndroid.show("Google Login Successful!", ToastAndroid.SHORT);
      console.log("Backend response:", data);
    } catch (error) {
      console.error("Google OAuth Error:", error);
      ToastAndroid.show("Google Login Failed", ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons
              name="logo-google"
              size={24}
              color="#fff"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
      {/* You can add more OAuth buttons below */}
    </View>
  );
};

export default OAuthButtons;

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: "#4285F4",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 5,
    width: "100%",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
