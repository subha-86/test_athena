import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

/* ================= BACKGROUND ================= */
const BG_IMAGE = require("../../assets/images/bg.png");

/* ================= API ================= */
const BASE_API = "https://sailwithcrm-athena.reportqube.com/api";
const ADD_MEETING_API = `${BASE_API}/calendar/add-meeting`;
const CUSTOMERS_API = `${BASE_API}/crm_data/customers`;

/* ================= PLAN MODES ================= */
const PLAN_MODES = [
  { label: "Online", value: 1 },
  { label: "Direct Meet", value: 2 },
  { label: "Phone", value: 3 },
  { label: "Business Courtesy", value: 4 },
  { label: "Business Entertainment", value: 5 },
];

/* ================= HELPERS ================= */
const pad = (n: number) => String(n).padStart(2, "0");

const formatDate = (d: Date) =>
  `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

const formatTime = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

export default function AddPlanScreen() {
  const router = useRouter();

  /* ================= CUSTOMER ================= */
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  /* ================= FORM ================= */
  const [activity, setActivity] = useState("");
  const [planMode, setPlanMode] = useState<number | null>(null);
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);

  const [dateObj, setDateObj] = useState(new Date());
  const [fromTime, setFromTime] = useState(new Date());
  const [toTime, setToTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000)
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [loading, setLoading] = useState(false);

  const canSubmit =
    customerName.trim() !== "" &&
    activity.trim() !== "" &&
    planMode !== null;

  /* ================= LOAD CUSTOMERS ================= */
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const crmUserId = await AsyncStorage.getItem("crmUserId");
      if (!crmUserId) return;

      const res = await axios.get(CUSTOMERS_API, {
        params: { user_id: crmUserId.toUpperCase() },
      });

      const list =
        res.data?.customers_interacted?.map((c: any) => ({
          id: c.customer_id,
          name: c.cust_name,
        })) || [];

      setCustomers(list);
    } catch (err) {
      console.log("Failed to load customers", err);
    }
  };

  /* ================= CREATE CUSTOMER IF NEW ================= */
  const getOrCreateCustomer = async () => {
    if (selectedCustomerId) {
      return { customer_id: selectedCustomerId, customer_name: customerName };
    }

    const existing = customers.find(
      (c) => c.name.toLowerCase() === customerName.toLowerCase()
    );

    if (existing) {
      return { customer_id: existing.id, customer_name: existing.name };
    }

    const crmUserId = await AsyncStorage.getItem("crmUserId");

    const res = await axios.post(CUSTOMERS_API, {
      cust_name: customerName,
      user_id: crmUserId?.toUpperCase(),
    });

    return {
      customer_id: res.data?.data?.customer_id,
      customer_name: customerName,
    };
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!canSubmit) {
      Alert.alert("Missing info", "Please fill all required fields");
      return;
    }

    try {
      setLoading(true);

      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) {
        Alert.alert("Error", "User ID not found");
        return;
      }

      const customer = await getOrCreateCustomer();

      await axios.post(ADD_MEETING_API, null, {
        params: {
          user_id: userId.toUpperCase(),
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          activity: activity.trim(),
          date: formatDate(dateObj),
          plan_mode: planMode,
          from_time: formatTime(fromTime),
          to_time: formatTime(toTime),
          ai_generated: false,
        },
      });

      Alert.alert("✅ Success", "Meeting added to calendar");
      router.replace("/(tabs)/calendar");
    } catch (err: any) {
      console.log("ADD MEETING ERROR", err?.response?.data || err);
      Alert.alert(
        "Error",
        err?.response?.data?.detail?.[0]?.msg ||
          err?.message ||
          "Failed to add meeting"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* BACK */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.backCircle}
            onPress={() => router.replace("/(tabs)/calendar")}
          >
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.card}>
              <Text style={styles.title}>Add Meeting</Text>

              {/* CUSTOMER */}
              <Text style={styles.label}>Customer *</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                placeholder="Type customer name or ID"
                onFocus={() => setShowCustomerDropdown(true)}
                onChangeText={(t) => {
                  setCustomerName(t);
                  setSelectedCustomerId(null);
                  setShowCustomerDropdown(true);
                }}
              />

              {showCustomerDropdown &&
                customers
                  .filter((c) =>
                    !customerName
                      ? true
                      : c.name
                          .toLowerCase()
                          .startsWith(customerName.toLowerCase()) ||
                        c.id.startsWith(customerName)
                  )
                  .map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCustomerName(c.name);
                        setSelectedCustomerId(c.id);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      <Text style={styles.customerName}>{c.name}</Text>
                      <Text style={styles.customerId}>ID: {c.id}</Text>
                    </Pressable>
                  ))}

              {/* ACTIVITY */}
              <Text style={styles.label}>Activity *</Text>
              <TextInput
                style={styles.input}
                value={activity}
                onChangeText={setActivity}
                placeholder="Meeting activity"
              />

              {/* DATE */}
              <Text style={styles.label}>Date *</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
              >
                <Text>{formatDate(dateObj)}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setDateObj(d);
                  }}
                />
              )}

              {/* PLAN MODE */}
              <Text style={styles.label}>Plan Mode *</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowPlanDropdown(!showPlanDropdown)}
              >
                <Text>
                  {PLAN_MODES.find((p) => p.value === planMode)?.label ??
                    "Select plan mode"}
                </Text>
              </Pressable>

              {showPlanDropdown &&
                PLAN_MODES.map((m) => (
                  <Pressable
                    key={m.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setPlanMode(m.value);
                      setShowPlanDropdown(false);
                    }}
                  >
                    <Text>{m.label}</Text>
                  </Pressable>
                ))}

              {/* FROM TIME */}
              <Text style={styles.label}>From Time</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowFromPicker(true)}
              >
                <Text>{formatTime(fromTime)}</Text>
              </Pressable>
              {showFromPicker && (
                <DateTimePicker
                  value={fromTime}
                  mode="time"
                  onChange={(_, d) => {
                    setShowFromPicker(false);
                    if (d) setFromTime(d);
                  }}
                />
              )}

              {/* TO TIME */}
              <Text style={styles.label}>To Time</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowToPicker(true)}
              >
                <Text>{formatTime(toTime)}</Text>
              </Pressable>
              {showToPicker && (
                <DateTimePicker
                  value={toTime}
                  mode="time"
                  onChange={(_, d) => {
                    setShowToPicker(false);
                    if (d) setToTime(d);
                  }}
                />
              )}

              {/* SAVE */}
              <Pressable
                onPress={handleSave}
                disabled={!canSubmit || loading}
                style={[
                  styles.saveBtn,
                  (!canSubmit || loading) && { opacity: 0.6 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Add Meeting</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  scroll: { padding: 20 },
  topBar: { paddingHorizontal: 16, paddingTop: 8 },
  backCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { fontSize: 22, fontWeight: "900", color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 20, elevation: 5 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#15314a",
    textAlign: "center",
    marginBottom: 20,
  },
  label: { marginTop: 14, marginBottom: 6, color: "#555", fontSize: 13 },
  input: {
    height: 46,
    backgroundColor: "#f2f6ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cfdafb",
    justifyContent: "center",
  },
  dropdownItem: {
    padding: 12,
    backgroundColor: "#eef3ff",
    borderRadius: 8,
    marginTop: 6,
  },
  customerName: { fontSize: 14, fontWeight: "700", color: "#15314a" },
  customerId: { fontSize: 12, color: "#666", marginTop: 2 },
  saveBtn: {
    marginTop: 24,
    backgroundColor: "#0D47A1",
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
