import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AIApi from "../hooks/aiApi";
import erpApi from "../hooks/erpApi";


// 🔔 Notifications
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

const bgImage = require("../../assets/images/bg.png");

/* ================= NOTIFICATION HELPERS ================= */

const SECURE_KEYS = {
  devicePushToken: "pushToken.device",
};

async function buildDeviceName() {
  try {
    const brand = Device.brand ?? "";
    const model = Device.modelName ?? "";
    const os = `${Platform.OS} ${Device.osVersion ?? ""}`.trim();
    return [brand, model, os].filter(Boolean).join(" ") || "Unknown Device";
  } catch {
    return "Unknown Device";
  }
}

async function getDevicePushTokenOrFetch(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(SECURE_KEYS.devicePushToken);
  if (stored) return stored;

  try {
    const res = await Notifications.getDevicePushTokenAsync();
    const token = (res as any)?.data ?? null;

    if (token) {
      await SecureStore.setItemAsync(SECURE_KEYS.devicePushToken, token);
    }
    return token;
  } catch (e) {
    console.warn("❌ Failed to get device push token", e);
    return null;
  }
}

function getDeviceType() {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  return "unknown";
}

async function registerNotificationToken() {
  try {
    const device_token = await getDevicePushTokenOrFetch();
    if (!device_token) return;

    const payload = {
      device_name: await buildDeviceName(),
      device_token,
      device_type: getDeviceType(),
    };

    await AIApi.post("/notifications/register-token", payload);
    console.log("✅ Notification token registered");
  } catch (e) {
    console.warn("❌ Failed to register notification token", e);
  }
}

/* ================= LOGIN SCREEN ================= */

export default function LoginScreen() {
  const router = useRouter();

  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 🔔 Request notification permission once
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.log("🔕 Notification permission not granted");
        }
      } catch (e) {
        console.warn("Notification permission error", e);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!empId || !password) {
      Alert.alert("Error", "Please enter user name and password");
      return;
    }

    try {
      setLoading(true);

      console.log("LOGIN REQUEST:", {
        username: empId.toUpperCase(),
      });

      const response = await erpApi.post(
        "/Athena/feeder/mobileApp/mobilelogin",
        {
          username: empId.toUpperCase(),
          password: password,
        },
        {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
          timeout: 15000,
        }
      );

      console.log("LOGIN RESPONSE:", response.data);
      const result = response.data;

      // ✅ SAME SUCCESS CHECK AS ANGULAR
      if (result && result.success === true) {
        const user = result.userDetail;

        await AsyncStorage.multiSet([
          ["isloggedIn", "true"],
          ["userId", user.userId],
          ["username", user.username],
          ["crmUserId", empId.toUpperCase()],
          ["email", user.email],
          ["designationName", user.designationName ?? ""],
          ["departmentName", user.departmentName ?? ""],
        ]);

        // 🔔 SAVE NOTIFICATION TOKEN AFTER LOGIN
        await registerNotificationToken();

        router.replace("/(tabs)");
      } else {
        Alert.alert(
          "Login Failed",
          result?.message || "Invalid username or password"
        );
      }
    } catch (error: any) {
      console.log("LOGIN ERROR FULL:", error);
      console.log("LOGIN ERROR RESPONSE:", error?.response?.data);

      Alert.alert(
        "Login Error",
        error?.response?.data?.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ImageBackground source={bgImage} style={styles.bg} resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.card}>
          <Text style={styles.title}>Login</Text>

          {/* USER NAME */}
          <Text style={styles.label}>User name</Text>
          <TextInput
            placeholder="User name"
            style={styles.input}
            autoCapitalize="characters"
            value={empId}
            onChangeText={setEmpId}
          />

          {/* PASSWORD */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="Password"
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.showText}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* LOGIN BUTTON */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity>
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0b0bff" },
  bg: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#111827",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    fontSize: 14,
  },

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },

  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 14 },

  showText: { color: "#1D4ED8", fontWeight: "600", fontSize: 13 },

  button: {
    backgroundColor: "#0F172A",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  buttonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },

  forgot: {
    marginTop: 16,
    textAlign: "center",
    color: "#1D4ED8",
    fontSize: 13,
  },
});
