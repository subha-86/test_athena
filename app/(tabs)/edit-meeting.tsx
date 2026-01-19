import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import aiApi from "../hooks/aiApi";

/* ================= CONSTANTS ================= */
const BG_IMAGE = require("../../assets/images/bg.png");

const PLAN_MODES = [
  { label: "Online", value: 1 },
  { label: "Direct Meet", value: 2 },
  { label: "Phone", value: 3 },
  { label: "Business Courtesy", value: 4 },
  { label: "Business Entertainment", value: 5 },
];

export default function EditMeetingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const meeting = params.meeting
    ? JSON.parse(params.meeting as string)
    : null;

  const meetingDate = params.meetingDate as string | undefined;

  /* ================= STATE ================= */
  const [date, setDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [planMode, setPlanMode] = useState<number | null>(null);

  // temp picker values (IMPORTANT)
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [tempTime, setTempTime] = useState<Date>(new Date());

  const [activePicker, setActivePicker] =
    useState<"date" | "from" | "to" | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ================= PREFILL ================= */
  useEffect(() => {
    if (!meeting) return;

    const d = meetingDate || meeting.date;
    if (d) {
      setDate(d);
      setTempDate(new Date(d));
    }

    if (meeting.from_time) {
      setFromTime(meeting.from_time);
      setTempTime(new Date(`1970-01-01T${meeting.from_time}`));
    }

    if (meeting.to_time) {
      setToTime(meeting.to_time);
    }

    setPlanMode(
      meeting.plan_mode !== null ? Number(meeting.plan_mode) : null
    );
  }, [meeting, meetingDate]);

  /* ================= UPDATE ================= */
  const handleUpdate = async () => {
    if (!date || !fromTime || !toTime || !planMode) {
      Alert.alert("Validation", "All fields are required");
      return;
    }

    try {
      setLoading(true);

      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) throw new Error("User ID missing");

      await aiApi.put("/calendar/edit-meeting", {}, {
        params: {
          pre_plan_id: meeting.pre_plan_id,
          user_id: userId,
          date,
          plan_mode: planMode,
          from_time: fromTime,
          to_time: toTime,
        },
      });

      Alert.alert("Success", "Meeting updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to update meeting");
    } finally {
      setLoading(false);
    }
  };

  const selectedPlanLabel =
    PLAN_MODES.find((p) => p.value === planMode)?.label ??
    "Select plan mode";

  if (!meeting) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>No meeting data found</Text>
      </SafeAreaView>
    );
  }

  /* ================= UI ================= */
  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>Edit Pre-Plan</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* CARD */}
          <View style={styles.card}>
            {/* DATE */}
            <Text style={styles.label}>📅 Date</Text>
            <Pressable
              style={styles.field}
              onPress={() => setActivePicker("date")}
            >
              <Text>{date || "Select date"}</Text>
            </Pressable>

            {/* PLAN MODE */}
            <Text style={styles.label}>📌 Plan Mode</Text>
            <Pressable
              style={styles.field}
              onPress={() => setShowPlanModal(true)}
            >
              <Text>{selectedPlanLabel}</Text>
            </Pressable>

            {/* TIME */}
            <View style={styles.row}>
              <Pressable
                style={styles.field}
                onPress={() => setActivePicker("from")}
              >
                <Text>{fromTime || "From time"}</Text>
              </Pressable>

              <Pressable
                style={styles.field}
                onPress={() => setActivePicker("to")}
              >
                <Text>{toTime || "To time"}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.saveBtn} onPress={handleUpdate}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* DATE / TIME PICKER (FIXED iOS UX) */}
        <Modal transparent visible={activePicker !== null} animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <DateTimePicker
                value={activePicker === "date" ? tempDate : tempTime}
                mode={activePicker === "date" ? "date" : "time"}
                display="spinner"
                onChange={(_, d) => {
                  if (!d) return;
                  activePicker === "date"
                    ? setTempDate(d)
                    : setTempTime(d);
                }}
              />

              <Pressable
                style={styles.doneBtn}
                onPress={() => {
                  if (activePicker === "date") {
                    setDate(tempDate.toISOString().slice(0, 10));
                  }
                  if (activePicker === "from") {
                    setFromTime(tempTime.toTimeString().slice(0, 8));
                  }
                  if (activePicker === "to") {
                    setToTime(tempTime.toTimeString().slice(0, 8));
                  }
                  setActivePicker(null);
                }}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* PLAN MODE MODAL */}
        <Modal transparent visible={showPlanModal} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              {PLAN_MODES.map((m) => (
                <Pressable
                  key={m.value}
                  style={styles.modalItem}
                  onPress={() => {
                    setPlanMode(m.value);
                    setShowPlanModal(false);
                  }}
                >
                  <Text style={styles.modalText}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </ImageBackground>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },

  card: {
    backgroundColor: "#ffffffee",
    borderRadius: 22,
    padding: 20,
  },

  label: { fontWeight: "700", marginTop: 14 },

  field: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    backgroundColor: "#f8fafc",
  },

  row: { flexDirection: "row", gap: 12, marginTop: 10 },

  saveBtn: {
    marginTop: 30,
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },

  pickerCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  doneBtn: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  doneText: { color: "#fff", fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },

  modal: { backgroundColor: "#fff", borderRadius: 16 },

  modalItem: { padding: 16 },

  modalText: { fontSize: 16, fontWeight: "600" },
});
