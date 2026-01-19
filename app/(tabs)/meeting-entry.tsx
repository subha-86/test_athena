import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

const DIVISIONS = [
  { label: "CHA", value: "cha" },
  { label: "CDL", value: "cdl" },
  { label: "3PL", value: "3pl" },
  { label: "Project Cargo", value: "project_cargo" },
  { label: "TPTR", value: "tptr" },
  { label: "FFW", value: "ffw" },
  { label: "Lines", value: "lines" },
  { label: "Container Sales", value: "container_sales" },
];

const PLAN_MODES = [
  { label: "Online", value: 1 },
  { label: "Direct Meet", value: 2 },
  { label: "Phone", value: 3 },
  { label: "Business Courtesy", value: 4 },
  { label: "Business Entertainment", value: 5 },
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

  /* ================= STATES ================= */
  const [customers, setCustomers] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [customerText, setCustomerText] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);

  const [contactPerson, setContactPerson] = useState("");
  const [division, setDivision] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<"import" | "export" | null>(null);
  const [transportMode, setTransportMode] = useState<"sea" | "air" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [nextCallDate, setNextCallDate] = useState<Date | null>(null);

  const [activity, setActivity] = useState("");
  const [cntryId, setCntryId] = useState(""); // This holds the City/Location Name
  const [mode, setMode] = useState<number | null>(null);

  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ================= RESET ON FRESH DIRECT ADD ================= */
  useFocusEffect(
    useCallback(() => {
      if (!params.pre_plan_id && !params.meeting) {
        setCustomerText("");
        setSelectedCustomerId(null);
        setCustomerEmail("");
        setContactPerson("");
        setDivision(null);
        setServiceType(null);
        setTransportMode(null);
        setRemarks("");
        setNextCallDate(null);
        setActivity("");
        setCntryId("");
        setMode(null);
        setShowCustomerDropdown(false);
      }
    }, [params.pre_plan_id, params.meeting])
  );

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
    if (customerText === "") {
      let meetingData: any = null;
      try {
        if (params.meeting && typeof params.meeting === "string") {
          meetingData = JSON.parse(params.meeting);
        }
      } catch (err) {
        console.log("Failed to parse meeting data");
      }

      if (meetingData) {
        if (meetingData.customer) setCustomerText(meetingData.customer);
        if (meetingData.customer_id) setSelectedCustomerId(meetingData.customer_id);
        if (meetingData.remarks) setRemarks(meetingData.remarks);
      } else if (customerId && customerName) {
        setCustomerText(customerName);
        setSelectedCustomerId(customerId);
      }
    }
  }, [params.meeting, customerId, customerName]);

  /* ================= AUTO LOCATION & PATCH CITY ================= */
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

        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (geo.length > 0) {
          const g = geo[0];
          const addr = [g.name, g.street, g.city, g.region, g.postalCode, g.country]
            .filter(Boolean)
            .join(", ");
          setAddress(addr);
          
          // Automatically patch City/Location name into cntryId state
          if (g.city) {
            setCntryId(g.city);
          } else if (g.region) {
            setCntryId(g.region);
          }
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

    if (text.trim().length > 0) {
      const filtered = customers.filter(
        c =>
          c.name.toLowerCase().includes(text.toLowerCase()) ||
          c.id.toString().toLowerCase().includes(text.toLowerCase())
      );
      setFilteredCustomers(filtered);
      setShowCustomerDropdown(true);
    } else {
      setShowCustomerDropdown(false);
    }
  };

  const handleSelectCustomer = (c: any) => {
    setCustomerText(c.name);
    setSelectedCustomerId(c.id);
    setCustomerEmail(c.email || "");
    setShowCustomerDropdown(false);
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (!selectedCustomerId && (!customerText || !customerEmail)) {
      Alert.alert("Validation Error", "Please select a customer or enter name & email");
      return false;
    }
    if (!serviceType) {
      Alert.alert("Validation Error", "Please select a service type");
      return false;
    }
    if (!transportMode) {
      Alert.alert("Validation Error", "Please select a transportation mode");
      return false;
    }
    if (!division) {
      Alert.alert("Validation Error", "Please select a division");
      return false;
    }
    if (!contactPerson.trim()) {
      Alert.alert("Validation Error", "Please enter contact person name");
      return false;
    }
    if (!remarks.trim()) {
      Alert.alert("Validation Error", "Please enter remarks");
      return false;
    }

    if (!prePlanId) {
      if (!activity.trim()) {
        Alert.alert("Validation Error", "Please enter activity");
        return false;
      }
      if (!cntryId.trim()) {
        Alert.alert("Validation Error", "Please enter location");
        return false;
      }
      if (mode === null) {
        Alert.alert("Validation Error", "Please select a mode");
        return false;
      }
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
        remarks,
        contact_person: contactPerson,
        transportation_mode: transportMode,
        service_type: serviceType,
        division,
      };

      if (address) payload.address = address;
      if (latitude !== null) payload.latitude = latitude;
      if (longitude !== null) payload.longitude = longitude;
      if (nextCallDate) payload.next_call_date = formatDDMMYYYY(nextCallDate);

      if (prePlanId) {
        payload.pre_plan_id = prePlanId;
      } else {
        payload.activity = activity;
        payload.cntry_id = cntryId; // Sending the location name
        payload.mode = mode;

        if (selectedCustomerId) {
          payload.customer_id = parseInt(selectedCustomerId);
        } else {
          payload.customer_name = customerText;
          payload.customer_email = customerEmail;
        }
      }

      await aiApi.post("/calendar/post-meeting", payload, {
        params: { user_id: userId.toUpperCase() },
      });

      Alert.alert("✅ Success", "Meeting posted successfully");
      router.replace("/(tabs)/calendar");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || e?.message || "Failed to post meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.title}>{prePlanId ? "Convert to Meeting" : "Add Meeting"}</Text>

              {/* CUSTOMER */}
              <View style={{ zIndex: 10 }}>
                <Text style={styles.label}>Customer *</Text>
                <TextInput
                  style={[styles.input, prePlanId && selectedCustomerId && styles.inputDisabled]}
                  value={customerText}
                  placeholder="Search or enter customer name"
                  onChangeText={handleCustomerChange}
                  onFocus={() => !prePlanId && customerText.length > 0 && setShowCustomerDropdown(true)}
                  editable={!(prePlanId && selectedCustomerId)}
                />

                {showCustomerDropdown && !prePlanId && (
                  <View style={styles.dropdownContainer}>
                    {filteredCustomers.map(c => (
                      <Pressable key={c.id} style={styles.dropdownItem} onPress={() => handleSelectCustomer(c)}>
                        <Text style={styles.customerName}>{c.name}</Text>
                        <Text style={styles.customerId}>ID: {c.id}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {!selectedCustomerId && !prePlanId && (
                <>
                  <Text style={styles.label}>Customer Email *</Text>
                  <TextInput
                    style={styles.input}
                    value={customerEmail}
                    onChangeText={setCustomerEmail}
                    keyboardType="email-address"
                    placeholder="Enter customer email"
                  />
                </>
              )}

              {selectedCustomerId && <Text style={styles.infoText}>Customer ID: {selectedCustomerId}</Text>}
              {prePlanId && <Text style={styles.infoText}>Pre-Plan ID: {prePlanId}</Text>}

              {/* CONDITIONALLY MANDATORY FIELDS */}
              {!prePlanId && (
                <>
                  <Text style={styles.label}>Activity *</Text>
                  <TextInput
                    style={styles.input}
                    value={activity}
                    onChangeText={setActivity}
                    placeholder="Enter activity description"
                  />

                  <Text style={styles.label}>Location *</Text>
                  <TextInput
                    style={styles.input}
                    value={cntryId}
                    onChangeText={setCntryId}
                    placeholder="Fetching location..."
                  />

                  <Text style={styles.label}>Mode *</Text>
                  <Pressable style={styles.input} onPress={() => setShowModeDropdown(!showModeDropdown)}>
                    <Text style={mode === null && { color: '#999' }}>
                      {PLAN_MODES.find(m => m.value === mode)?.label || "Select mode"}
                    </Text>
                  </Pressable>
                  {showModeDropdown && PLAN_MODES.map(m => (
                    <Pressable key={m.value} style={styles.dropdownItem} onPress={() => { setMode(m.value); setShowModeDropdown(false); }}>
                      <Text>{m.label}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              {/* LOCATION PREVIEW */}
              <Text style={styles.label}>Address Details</Text>
              <View style={styles.readOnlyBox}>
                {locationLoading ? <ActivityIndicator color="#0D47A1" /> : (
                  <>
                    <Text style={styles.readOnlyText}>{address || "N/A"}</Text>
                    <Text style={styles.coords}>Lat: {latitude?.toFixed(6)} | Lng: {longitude?.toFixed(6)}</Text>
                  </>
                )}
              </View>

              {/* SERVICE TYPE */}
              <Text style={styles.label}>Service Type *</Text>
              <Pressable style={styles.input} onPress={() => setShowServiceDropdown(!showServiceDropdown)}>
                <Text style={!serviceType && { color: '#999' }}>
                  {SERVICE_TYPES.find(s => s.value === serviceType)?.label || "Select service type"}
                </Text>
              </Pressable>
              {showServiceDropdown && SERVICE_TYPES.map(s => (
                <Pressable key={s.value} style={styles.dropdownItem} onPress={() => { setServiceType(s.value as any); setShowServiceDropdown(false); }}>
                  <Text>{s.label}</Text>
                </Pressable>
              ))}

              {/* TRANSPORT MODE */}
              <Text style={styles.label}>Transportation Mode *</Text>
              <Pressable style={styles.input} onPress={() => setShowTransportDropdown(!showTransportDropdown)}>
                <Text style={!transportMode && { color: '#999' }}>
                  {TRANSPORT_MODES.find(t => t.value === transportMode)?.label || "Select transportation mode"}
                </Text>
              </Pressable>
              {showTransportDropdown && TRANSPORT_MODES.map(t => (
                <Pressable key={t.value} style={styles.dropdownItem} onPress={() => { setTransportMode(t.value as any); setShowTransportDropdown(false); }}>
                  <Text>{t.label}</Text>
                </Pressable>
              ))}

              <Text style={styles.label}>Contact Person *</Text>
              <TextInput 
                style={styles.input} 
                value={contactPerson} 
                onChangeText={setContactPerson} 
                placeholder="Enter contact person name" 
              />

              <Text style={styles.label}>Division *</Text>
              <Pressable style={styles.input} onPress={() => setShowDivisionDropdown(!showDivisionDropdown)}>
                <Text style={!division && { color: '#999' }}>
                  {DIVISIONS.find(d => d.value === division)?.label || "Select division"}
                </Text>
              </Pressable>
              {showDivisionDropdown && DIVISIONS.map(d => (
                <Pressable key={d.value} style={styles.dropdownItem} onPress={() => { setDivision(d.value); setShowDivisionDropdown(false); }}>
                  <Text>{d.label}</Text>
                </Pressable>
              ))}

              <Text style={styles.label}>Remarks *</Text>
              <TextInput 
                style={[styles.input, { height: 80 }]} 
                multiline 
                value={remarks} 
                onChangeText={setRemarks} 
                placeholder="Enter meeting remarks or notes" 
              />

              <Pressable style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Post Meeting</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 20 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 20, color: "#051539" },
  label: { marginTop: 14, marginBottom: 6, color: "#555", fontWeight: "600" },
  input: { backgroundColor: "#f2f6ff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#cfdafb" },
  inputDisabled: { backgroundColor: "#f0f0f0", borderColor: "#ddd" },
  dropdownContainer: { backgroundColor: "#fff", borderRadius: 8, marginTop: 4, borderWidth: 1, borderColor: "#cfdafb", overflow: 'hidden', maxHeight: 200 },
  dropdownItem: { padding: 12, backgroundColor: "#eef3ff", borderBottomWidth: 1, borderBottomColor: "#cfdafb" },
  customerName: { fontWeight: "700", color: "#051539" },
  customerId: { fontSize: 12, color: "#666", marginTop: 2 },
  infoText: { fontSize: 12, color: "#0D47A1", marginTop: 4, fontWeight: "600", backgroundColor: "#E3F2FD", padding: 8, borderRadius: 6 },
  readOnlyBox: { backgroundColor: "#f5f7fb", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#d0d7f5" },
  readOnlyText: { fontSize: 13, color: "#333" },
  coords: { fontSize: 11, color: "#666", marginTop: 4 },
  saveBtn: { marginTop: 24, backgroundColor: "#0D47A1", paddingVertical: 14, borderRadius: 28, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});