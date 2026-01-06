import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const bgImage = require("../../assets/images/bg.png");

/* ================= DISTANCE UTILITY ================= */
const getDistanceInKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function CallEntryAddScreen() {
  const router = useRouter();

  /* ================= MANDATORY ================= */
  const [visitDate, setVisitDate] = useState<Date | null>(null);
  const [showVisitPicker, setShowVisitPicker] = useState(false);
  const [contactPerson, setContactPerson] = useState("");
  const [customer, setCustomer] = useState("");
  const [salesType, setSalesType] = useState("");

  /* ================= CURRENT GPS ================= */
  const [currentLatLng, setCurrentLatLng] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission is required");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLatLng({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    })();
  }, []);

  /* ================= DETAILS ================= */
  const [details, setDetails] = useState([
    {
      address: "",
      area: "",
      termOfSale: "",
      nature: "HOT",
      callStatus: "MATERIALISED",
      transport: "SEA",
      serviceType: "EXPORT",
      latitude: null as number | null,
      longitude: null as number | null,
    },
  ]);

  const addDetailCard = () => {
    setDetails((prev) => [
      ...prev,
      {
        address: "",
        area: "",
        termOfSale: "",
        nature: "HOT",
        callStatus: "MATERIALISED",
        transport: "SEA",
        serviceType: "EXPORT",
        latitude: null,
        longitude: null,
      },
    ]);
  };

  /* ================= SAVE ================= */
  const submit = () => {
    if (!visitDate || !contactPerson || !customer || !salesType) {
      Alert.alert("Missing Fields", "Fill all mandatory fields");
      return;
    }

    if (!currentLatLng) {
      Alert.alert("Location Error", "Unable to fetch current location");
      return;
    }

    for (let i = 0; i < details.length; i++) {
      const d = details[i];

      if (d.address) {
        if (!d.latitude || !d.longitude) {
          Alert.alert(
            "Location Missing",
            `Capture location for Call Detail ${i + 1}`
          );
          return;
        }

        const distance = getDistanceInKm(
          currentLatLng.latitude,
          currentLatLng.longitude,
          d.latitude,
          d.longitude
        );

        if (distance > 1) {
          Alert.alert(
            "Location Validation Failed",
            `Call Detail ${i + 1} is ${distance.toFixed(
              2
            )} KM away.\nAllowed distance is 1 KM`
          );
          return;
        }
      }
    }

    Alert.alert("Success", "Call Entry Saved Successfully");
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ImageBackground source={bgImage} style={{ flex: 1 }}>
        <View style={styles.overlay} />

        {/* ================= HEADER ================= */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Call Entry</Text>
        </View>

        {/* ================= MANDATORY CARD ================= */}
        <View style={styles.mandatoryCard}>
          <TouchableOpacity
            style={styles.visitDateRow}
            onPress={() => setShowVisitPicker(true)}
          >
            <Ionicons name="calendar-outline" size={14} />
            <Text>
              {visitDate
                ? visitDate.toISOString().split("T")[0]
                : "Visit Date *"}
            </Text>
          </TouchableOpacity>

          <View style={styles.grid}>
            <TextInput
              placeholder="Contact Person *"
              style={styles.inputHalf}
              value={contactPerson}
              onChangeText={setContactPerson}
            />
            <TextInput
              placeholder="Customer *"
              style={styles.inputHalf}
              value={customer}
              onChangeText={setCustomer}
            />
            <TextInput
              placeholder="Sales Type *"
              style={styles.inputFull}
              value={salesType}
              onChangeText={setSalesType}
            />
          </View>
        </View>

        {showVisitPicker && (
          <DateTimePicker
            value={visitDate || new Date()}
            mode="date"
            onChange={(_, d) => {
              setShowVisitPicker(false);
              if (d) setVisitDate(d);
            }}
          />
        )}

        {/* ================= DETAILS ================= */}
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {details.map((item, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.cardTitle}>Call Detail {index + 1}</Text>

              <TextInput
                placeholder="Address"
                style={styles.inputFull}
                value={item.address}
                onChangeText={(v) => {
                  const copy = [...details];
                  copy[index].address = v;
                  setDetails(copy);
                }}
              />

              <TextInput
                placeholder="Area"
                style={styles.inputFull}
                value={item.area}
                onChangeText={(v) => {
                  const copy = [...details];
                  copy[index].area = v;
                  setDetails(copy);
                }}
              />

              <TouchableOpacity
                style={styles.locationBtn}
                onPress={async () => {
                  const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                  });

                  const copy = [...details];
                  copy[index].latitude = pos.coords.latitude;
                  copy[index].longitude = pos.coords.longitude;
                  setDetails(copy);

                  Alert.alert("Location Captured");
                }}
              >
                <Ionicons name="location-outline" size={16} />
                <Text>Capture Location</Text>
              </TouchableOpacity>

              {item.latitude && (
                <Text style={styles.latLng}>
                  Lat: {item.latitude.toFixed(5)} | Lng:{" "}
                  {item.longitude?.toFixed(5)}
                </Text>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addDetailCard}>
            <Ionicons name="add-circle-outline" size={20} />
            <Text>Add Another Detail</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={submit}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              SAVE CALL ENTRY
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fff",
  },

  headerTitle: { fontSize: 18, fontWeight: "700", marginLeft: 10 },

  mandatoryCard: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  visitDateRow: { flexDirection: "row", gap: 6, marginBottom: 10 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  inputHalf: {
    width: "48%",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 8,
  },

  inputFull: {
    width: "100%",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardTitle: { fontWeight: "700", marginBottom: 10 },

  locationBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    padding: 8,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
  },

  latLng: { fontSize: 12, color: "#555", marginTop: 4 },

  addBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 10,
  },

  saveBtn: {
    backgroundColor: "#16A34A",
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
  },
});
