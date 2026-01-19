import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import aiApi from "../hooks/aiApi";

/* ================= BACKGROUND ================= */
const BG_IMAGE = require("../../assets/images/bg.png");

/* ================= CONSTANT OPTIONS ================= */
const SERVICE_TYPES = [
  { label: "Import", value: "import" },
  { label: "Export", value: "export" },
];

const TRANSPORT_MODES = [
  { label: "Sea", value: "sea" },
  { label: "Air", value: "air" },
];

/* ================= HELPERS ================= */
const pad = (n: number) => String(n).padStart(2, "0");
const formatDDMMYYYY = (d: Date) =>
  `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

/* ================= COMPONENT ================= */
export default function AddMeetingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  /* ================= PARAMS FROM CALENDAR ================= */
  const prePlanId = typeof params.pre_plan_id === "string" ? params.pre_plan_id : "";
  const customerId = typeof params.customer_id === "string" ? params.customer_id : "";
  const customerName = typeof params.customer === "string" ? params.customer : "";
  
  // Parse full meeting data if passed from calendar
  let meetingData: any = null;
  try {
    if (params.meeting && typeof params.meeting === "string") {
      meetingData = JSON.parse(params.meeting);
    }
  } catch (err) {
    console.log("Failed to parse meeting data");
  }

  /* ================= CUSTOMER ================= */
  const [customers, setCustomers] = useState<
    { id: string; name: string; email?: string }[]
  >([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [customerText, setCustomerText] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  /* ================= LOCATION ================= */
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);

  /* ================= MEETING FIELDS ================= */
  const [contactPerson, setContactPerson] = useState("");
  const [division, setDivision] = useState("");
  const [serviceType, setServiceType] = useState<"import" | "export" | null>(null);
  const [transportMode, setTransportMode] = useState<"sea" | "air" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [nextCallDate, setNextCallDate] = useState<Date | null>(null);

  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);

  const [loading, setLoading] = useState(false);

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
          email: c.email_id,
        })) || [];

      setCustomers(list);
      setFilteredCustomers(list);
    })();
  }, []);

  /* ================= PRE-FILL FROM CALENDAR DATA ================= */
  useEffect(() => {
    if (meetingData) {
      // Pre-fill customer info
      if (meetingData.customer) {
        setCustomerText(meetingData.customer);
      }
      if (meetingData.customer_id) {
        setSelectedCustomerId(meetingData.customer_id);
      }
      
      // Pre-fill remarks if available
      if (meetingData.remarks) {
        setRemarks(meetingData.remarks);
      }
    } else if (customerId && customerName) {
      // Fallback to individual params
      setCustomerText(customerName);
      setSelectedCustomerId(customerId);
    }
  }, [meetingData, customerId, customerName]);

  /* ================= AUTO LOCATION ================= */
  useEffect(() => {
    (async () => {
      try {
        setLocationLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const { latitude, longitude } = loc.coords;
        setLatitude(latitude);
        setLongitude(longitude);

        const geo = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (geo.length > 0) {
          const g = geo[0];
          const addr = [
            g.name,
            g.street,
            g.city,
            g.region,
            g.postalCode,
            g.country,
          ]
            .filter(Boolean)
            .join(", ");
          setAddress(addr);
        }
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  /* ================= CUSTOMER INPUT ================= */
  const handleCustomerChange = (text: string) => {
    setCustomerText(text);
    setSelectedCustomerId(null);

    const filtered = customers.filter(
      c =>
        c.name.toLowerCase().includes(text.toLowerCase()) ||
        c.id.toLowerCase().includes(text.toLowerCase())
    );

    setFilteredCustomers(filtered);
    setShowCustomerDropdown(true);
  };

  const handleSelectCustomer = (c: any) => {
    setCustomerText(c.name);
    setSelectedCustomerId(c.id);
    setCustomerEmail(c.email || "");
    setShowCustomerDropdown(false);
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    // Always require customer
    if (!selectedCustomerId && (!customerText || !customerEmail)) {
      Alert.alert(
        "Validation Error",
        "Please select a customer or enter customer name & email"
      );
      return false;
    }

    // Require service type
    if (!serviceType) {
      Alert.alert("Validation Error", "Please select a service type");
      return false;
    }

    // Require transport mode
    if (!transportMode) {
      Alert.alert("Validation Error", "Please select a transportation mode");
      return false;
    }

    return true;
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) throw new Error("User ID missing");

      const payload: any = {
        address,
        latitude,
        longitude,
        contact_person: contactPerson,
        division,
        service_type: serviceType,
        transportation_mode: transportMode,
        remarks,
        next_call_date: nextCallDate ? formatDDMMYYYY(nextCallDate) : undefined,
      };

      // If converting from calendar (has prePlanId), include it
      if (prePlanId) {
        payload.pre_plan_id = prePlanId;
      } else {
        // When creating a new plan, pre_plan_id should be empty string
        payload.pre_plan_id = "";
      }

      // ALWAYS include customer info (required by API)
      if (selectedCustomerId) {
        payload.customer_id = selectedCustomerId;
      } else {
        // For new customers
        payload.customer_name = customerText;
        payload.customer_email = customerEmail;
      }

      console.log("Payload being sent:", JSON.stringify(payload, null, 2));

      await aiApi.post("/calendar/post-meeting", payload, {
        params: { user_id: userId.toUpperCase() },
      });

      Alert.alert("✅ Success", "Meeting posted successfully");
      router.replace("/(tabs)/calendar");
    } catch (e: any) {
      console.error("Post meeting error:", e);
      Alert.alert("Error", e?.message || "Failed to post meeting");
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
                {prePlanId ? "Convert to Meeting" : "Add Meeting"}
              </Text>

              {/* CUSTOMER */}
              <Text style={styles.label}>Customer *</Text>
              <TextInput
                style={[
                  styles.input,
                  prePlanId && selectedCustomerId && styles.inputDisabled
                ]}
                value={customerText}
                placeholder="Search or enter customer name"
                onChangeText={handleCustomerChange}
                onFocus={() => !prePlanId && setShowCustomerDropdown(true)}
                editable={!(prePlanId && selectedCustomerId)}
              />

              {showCustomerDropdown &&
                !prePlanId &&
                filteredCustomers.map(c => (
                  <Pressable
                    key={c.id}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectCustomer(c)}
                  >
                    <Text style={styles.customerName}>{c.name}</Text>
                    <Text style={styles.customerId}>ID: {c.id}</Text>
                  </Pressable>
                ))}

              {!selectedCustomerId && !prePlanId && (
                <>
                  <Text style={styles.label}>Customer Email *</Text>
                  <TextInput
                    style={styles.input}
                    value={customerEmail}
                    onChangeText={setCustomerEmail}
                    keyboardType="email-address"
                  />
                </>
              )}

              {selectedCustomerId && (
                <Text style={styles.infoText}>
                  Customer ID: {selectedCustomerId}
                </Text>
              )}

              {prePlanId && (
                <Text style={styles.infoText}>
                  Pre-Plan ID: {prePlanId}
                </Text>
              )}

              {/* LOCATION */}
              <Text style={styles.label}>Current Location</Text>
              <View style={styles.readOnlyBox}>
                {locationLoading ? (
                  <ActivityIndicator />
                ) : (
                  <>
                    <Text style={styles.readOnlyText}>{address || "N/A"}</Text>
                    <Text style={styles.coords}>
                      Lat: {latitude?.toFixed(6)} | Lng: {longitude?.toFixed(6)}
                    </Text>
                  </>
                )}
              </View>

              {/* SERVICE TYPE */}
              <Text style={styles.label}>Service Type *</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowServiceDropdown(!showServiceDropdown)}
              >
                <Text>
                  {SERVICE_TYPES.find(s => s.value === serviceType)?.label ||
                    "Select service type"}
                </Text>
              </Pressable>

              {showServiceDropdown &&
                SERVICE_TYPES.map(s => (
                  <Pressable
                    key={s.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setServiceType(s.value);
                      setShowServiceDropdown(false);
                    }}
                  >
                    <Text>{s.label}</Text>
                  </Pressable>
                ))}

              {/* TRANSPORT MODE */}
              <Text style={styles.label}>Transportation Mode *</Text>
              <Pressable
                style={styles.input}
                onPress={() => setShowTransportDropdown(!showTransportDropdown)}
              >
                <Text>
                  {TRANSPORT_MODES.find(t => t.value === transportMode)?.label ||
                    "Select transportation mode"}
                </Text>
              </Pressable>

              {showTransportDropdown &&
                TRANSPORT_MODES.map(t => (
                  <Pressable
                    key={t.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setTransportMode(t.value);
                      setShowTransportDropdown(false);
                    }}
                  >
                    <Text>{t.label}</Text>
                  </Pressable>
                ))}

              {/* OTHER */}
              <Text style={styles.label}>Contact Person</Text>
              <TextInput
                style={styles.input}
                value={contactPerson}
                onChangeText={setContactPerson}
              />

              <Text style={styles.label}>Division</Text>
              <TextInput
                style={styles.input}
                value={division}
                onChangeText={setDivision}
              />

              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                multiline
                value={remarks}
                onChangeText={setRemarks}
              />

              <Pressable
                style={[styles.saveBtn, loading && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Post Meeting</Text>
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
    color: "#051539"
  },
  label: { marginTop: 14, marginBottom: 6, color: "#555", fontWeight: "600" },
  input: {
    backgroundColor: "#f2f6ff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#cfdafb",
  },
  inputDisabled: {
    backgroundColor: "#f0f0f0",
    borderColor: "#ddd",
  },
  dropdownItem: {
    padding: 12,
    backgroundColor: "#eef3ff",
    borderRadius: 8,
    marginTop: 6,
  },
  customerName: { fontWeight: "700", color: "#051539" },
  customerId: { fontSize: 12, color: "#666", marginTop: 2 },
  infoText: {
    fontSize: 12,
    color: "#0D47A1",
    marginTop: 4,
    fontWeight: "600",
    backgroundColor: "#E3F2FD",
    padding: 8,
    borderRadius: 6,
  },

  readOnlyBox: {
    backgroundColor: "#f5f7fb",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d0d7f5",
  },
  readOnlyText: { fontSize: 13, color: "#333" },
  coords: { fontSize: 11, color: "#666", marginTop: 4 },

  saveBtn: {
    marginTop: 24,
    backgroundColor: "#0D47A1",
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});