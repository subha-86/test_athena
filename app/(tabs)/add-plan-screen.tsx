import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import aiApi from "../hooks/aiApi";

/* ================= BACKGROUND ================= */
const BG_IMAGE = require("../../assets/images/bg.png");

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

/* ✅ FULL DATETIME (REQUIRED BY BACKEND) */
const formatDateTime = (date: Date, time: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(time.getHours())}:${pad(time.getMinutes())}:00`;

const parseDDMMYYYY = (s?: string) => {
  if (!s) return null;
  // Handle DD-MM-YYYY format
  const parts = s.split("-");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map(Number);
    if (dd && mm && yyyy) {
      const d = new Date(yyyy, mm - 1, dd);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // Try YYYY-MM-DD format
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts.map(Number);
    if (dd && mm && yyyy) {
      const d = new Date(yyyy, mm - 1, dd);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  // Try parsing as ISO string
  const isoDate = new Date(s);
  if (!Number.isNaN(isoDate.getTime())) return isoDate;
  return null;
};

const parseHHMMSS = (s?: string) => {
  if (!s) return null;
  const [hh, mm] = s.split(":").map(Number);
  if (hh === undefined || mm === undefined) return null;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
};

const normalizePlanMode = (pm: any): number | null => {
  const n = Number(pm);
  return PLAN_MODES.some(p => p.value === n) ? n : null;
};

export default function AddPlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const didPrefill = useRef<string>("");

  /* ================= EDIT MODE ================= */
  const prePlanId =
    typeof params.pre_plan_id === "string" ? params.pre_plan_id : undefined;
  const isEdit = !!prePlanId;

  // Create a unique key for this navigation to detect when params change
  const paramsKey = `${prePlanId || "new"}-${params.meeting ? "has-meeting" : "no-meeting"}`;

  /* ================= STATE ================= */
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<
    { id: string; name: string }[]
  >([]);

  const [customerName, setCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [activity, setActivity] = useState("");
  const [planMode, setPlanMode] = useState<number | null>(null);

  const [dateObj, setDateObj] = useState(new Date());
  const [fromTime, setFromTime] = useState(new Date());
  const [toTime, setToTime] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);

  const [loading, setLoading] = useState(false);

  const canSubmit = planMode !== null;

  /* ================= LOAD CUSTOMERS ================= */
  useEffect(() => {
    (async () => {
      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) return;

      const res = await aiApi.get("/crm_data/customers", {
        params: { user_id: userId.toUpperCase() },
      });

      const list =
        res.data?.customers_interacted?.map((c: any) => ({
          id: c.customer_id,
          name: c.cust_name,
        })) || [];

      setCustomers(list);
      setFilteredCustomers(list);
    })();
  }, []);

  /* ================= PREFILL ================= */
  useEffect(() => {
    // Only prefill if params have changed (new navigation)
    if (didPrefill.current === paramsKey) return;
    didPrefill.current = paramsKey;

    // Parse meeting JSON if provided (from calendar edit button)
    let meetingData: any = null;
    if (typeof params.meeting === "string" && params.meeting) {
      try {
        meetingData = JSON.parse(params.meeting);
        console.log("Parsed meeting data:", meetingData);
      } catch (e) {
        console.log("Failed to parse meeting JSON", e);
      }
    }

    // Prefer meeting data over individual params
    if (meetingData) {
      console.log("Prefilling from meeting data:", meetingData);
      
      // Customer
      if (meetingData.customer) {
        setCustomerName(String(meetingData.customer));
      } else if (meetingData.customer_name) {
        setCustomerName(String(meetingData.customer_name));
      }
      if (meetingData.customer_id) {
        setSelectedCustomerId(String(meetingData.customer_id));
      }

      // Activity
      if (meetingData.activity) {
        setActivity(String(meetingData.activity));
      }

      // Date - try multiple formats
      let dateSet = false;
      if (meetingData.date) {
        const d = parseDDMMYYYY(String(meetingData.date));
        if (d) {
          setDateObj(d);
          dateSet = true;
        }
      }
      if (!dateSet && params.date) {
        const d = parseDDMMYYYY(params.date as string);
        if (d) setDateObj(d);
      }

      // Times - handle both from_time/to_time and plan_time
      // plan_time might be in format "HH:mm" or "HH:mm:ss" or full datetime
      if (meetingData.from_time) {
        const ft = parseHHMMSS(String(meetingData.from_time));
        if (ft) setFromTime(ft);
      } else if (meetingData.plan_time) {
        // plan_time might be "10:00 AM" or "10:00:00" or "2026-01-15 10:00:00"
        const planTimeStr = String(meetingData.plan_time);
        // Try to extract just time part if it's a full datetime
        const timePart = planTimeStr.includes(" ") 
          ? planTimeStr.split(" ")[1] 
          : planTimeStr;
        const ft = parseHHMMSS(timePart);
        if (ft) setFromTime(ft);
      } else if (params.from_time) {
        const ft = parseHHMMSS(params.from_time as string);
        if (ft) setFromTime(ft);
      }

      if (meetingData.to_time) {
        const tt = parseHHMMSS(String(meetingData.to_time));
        if (tt) setToTime(tt);
      } else if (meetingData.plan_time) {
        // Use plan_time for to_time if to_time not available (add 1 hour as default)
        const planTimeStr = String(meetingData.plan_time);
        const timePart = planTimeStr.includes(" ") 
          ? planTimeStr.split(" ")[1] 
          : planTimeStr;
        const ft = parseHHMMSS(timePart);
        if (ft) {
          const tt = new Date(ft);
          tt.setHours(tt.getHours() + 1);
          setToTime(tt);
        }
      } else if (params.to_time) {
        const tt = parseHHMMSS(params.to_time as string);
        if (tt) setToTime(tt);
      }

      // Plan Mode
      if (meetingData.plan_mode !== undefined && meetingData.plan_mode !== null) {
        setPlanMode(normalizePlanMode(meetingData.plan_mode));
      } else if (params.plan_mode !== undefined) {
        setPlanMode(normalizePlanMode(params.plan_mode));
      }
    } else {
      // Fallback to individual params if no meeting JSON
      if (params.customer_name) setCustomerName(String(params.customer_name));
      if (params.customer_id) setSelectedCustomerId(String(params.customer_id));
      if (params.activity) setActivity(String(params.activity));

      const d = parseDDMMYYYY(params.date as string);
      if (d) setDateObj(d);

      const ft = parseHHMMSS(params.from_time as string);
      if (ft) setFromTime(ft);

      const tt = parseHHMMSS(params.to_time as string);
      if (tt) setToTime(tt);

      if (params.plan_mode !== undefined) {
        setPlanMode(normalizePlanMode(params.plan_mode));
      }
    }
  }, [params]);

  /* ================= CUSTOMER SEARCH ================= */
  const handleCustomerChange = (text: string) => {
    setCustomerName(text);
    if (isEdit) return;

    const filtered = customers.filter(
      c =>
        c.name.toLowerCase().includes(text.toLowerCase()) ||
        c.id.toLowerCase().includes(text.toLowerCase())
    );

    setFilteredCustomers(filtered);
    setShowCustomerDropdown(true);
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);

      const userId =
        (typeof params.user_id === "string" && params.user_id) ||
        (await AsyncStorage.getItem("crmUserId"));

      if (!userId) throw new Error("User ID missing");

      if (isEdit && prePlanId) {
        /* 🔒 EDIT API - send all data */
        await aiApi.put("/calendar/edit-meeting", null, {
          params: {
            pre_plan_id: prePlanId,
            user_id: userId.toUpperCase(),
            customer_id: selectedCustomerId || undefined,
            customer_name: customerName || undefined,
            activity: activity || undefined,
            date: formatDate(dateObj),
            plan_mode: planMode,
            from_time: formatDateTime(dateObj, fromTime),
            to_time: formatDateTime(dateObj, toTime),
          },
        });
        Alert.alert("✅ Success", "Meeting updated");
      } else {
        /* ➕ ADD API */
        await aiApi.post("/calendar/add-meeting", null, {
          params: {
            user_id: userId.toUpperCase(),
            customer_id: selectedCustomerId,
            activity,
            date: formatDate(dateObj),
            plan_mode: planMode,
            from_time: formatDateTime(dateObj, fromTime),
            to_time: formatDateTime(dateObj, toTime),
          },
        });
        Alert.alert("✅ Success", "Meeting added");

        // Clear all fields after successful add
        setCustomerName("");
        setSelectedCustomerId(null);
        setActivity("");
        setPlanMode(null);
        setDateObj(new Date());
        setFromTime(new Date());
        setToTime(new Date());
        setShowCustomerDropdown(false);
        setShowPlanDropdown(false);
      }

      router.replace("/(tabs)/calendar");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.card}>
              <Text style={styles.title}>
                {isEdit ? "Edit Meeting" : "Add Meeting"}
              </Text>

              {/* CUSTOMER */}
              <Text style={styles.label}>Customer</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                editable={!isEdit}
                placeholder="Search customer"
                onChangeText={handleCustomerChange}
                onFocus={() => !isEdit && setShowCustomerDropdown(true)}
              />

              {!isEdit &&
                showCustomerDropdown &&
                filteredCustomers.map(c => (
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
              <Text style={styles.label}>Activity</Text>
              <TextInput
                style={styles.input}
                value={activity}
                editable={!isEdit}
                onChangeText={setActivity}
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

              {/* FROM TIME */}
              <Text style={styles.label}>From Time</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowFromPicker(true)}
              >
                <Text>{formatDateTime(dateObj, fromTime)}</Text>
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
                <Text>{formatDateTime(dateObj, toTime)}</Text>
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

              {/* PLAN MODE */}
              <Text style={styles.label}>Plan Mode *</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowPlanDropdown(!showPlanDropdown)}
              >
                <Text>
                  {PLAN_MODES.find(p => p.value === planMode)?.label ??
                    "Select plan mode"}
                </Text>
              </Pressable>

              {showPlanDropdown &&
                PLAN_MODES.map(m => (
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

              {/* SAVE */}
              <Pressable
                style={[
                  styles.saveBtn,
                  (!canSubmit || loading) && { opacity: 0.6 },
                ]}
                disabled={!canSubmit || loading}
                onPress={handleSave}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>
                    {isEdit ? "Update Meeting" : "Add Meeting"}
                  </Text>
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
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
  },
  label: { marginTop: 14, marginBottom: 6, color: "#555" },
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
  customerName: { fontWeight: "700" },
  customerId: { fontSize: 12, color: "#666" },
  saveBtn: {
    marginTop: 24,
    backgroundColor: "#0D47A1",
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
