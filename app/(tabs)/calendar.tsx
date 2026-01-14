import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/* ================= BACKGROUND ================= */
const BG_IMAGE = require("../../assets/images/bg.png");

/* ================= API ================= */
const API_URL =
  "https://sailwithcrm-athena.reportqube.com/api/calendar/view";

/* ================= HELPERS ================= */
const pad = (n: number) => String(n).padStart(2, "0");
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const addDays = (d: Date, days: number) => {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
};

const buildWeek = (base: Date) =>
  Array.from({ length: 7 }, (_, i) => addDays(base, i - 3));

const getKey = (d: Date) =>
  `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

/* ================= STATUS HELPERS ================= */
const getCardStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "met":
      return styles.cardMet;
    case "not met":
      return styles.cardNotMet;
    default:
      return styles.cardDefault;
  }
};

const getStatusBadgeStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "met":
      return styles.statusMet;
    case "not met":
      return styles.statusNotMet;
    default:
      return styles.statusDefault;
  }
};

/* ================= COMPONENT ================= */
export default function CalendarScreen() {
  const router = useRouter();
  const WIDTH = Dimensions.get("window").width - 32;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [meetingsMap, setMeetingsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const weeks = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) =>
        buildWeek(addDays(selectedDate, (i - 4) * 7))
      ),
    [selectedDate]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: WIDTH * 4, animated: false });
  }, [WIDTH]);

  /* ================= FETCH ================= */
  const fetchMeetings = useCallback(async (date: Date) => {
    const key = getKey(date);

    if (meetingsMap[key]) {
      setMeetings(meetingsMap[key]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) throw new Error("User ID missing");

      const resp = await axios.get(API_URL, {
        params: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          user_id: userId,
        },
      });

      const calendar = resp.data?.calendar_meetings || {};
      const data = Array.isArray(calendar[key]) ? calendar[key] : [];

      setMeetingsMap((prev) => ({ ...prev, [key]: data }));
      setMeetings(data);
    } catch (err) {
      console.error("CALENDAR FETCH FAILED", err);
      setError("Failed to load calendar");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [meetingsMap]);

  useEffect(() => {
    fetchMeetings(selectedDate);
  }, [selectedDate, fetchMeetings]);/* ================= DELETE ================= */
const handleDelete = (postPlanId: string) => {
  Alert.alert(
    "Delete Meeting",
    "Are you sure you want to delete this meeting?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);

            await axios.post(
              "https://sailwithcrm-athena.reportqube.com/api/calendar/delete-meeting",
              { post_plan_id: postPlanId }
            );

            setMeetings((prev) =>
              prev.filter((m) => m.post_plan_id !== postPlanId)
            );
          } catch {
            Alert.alert("Error", "Delete failed");
          } finally {
            setLoading(false);
          }
        },
      },
    ]
  );
};


  /* ================= UI ================= */
  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.headerBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>

            <View style={{ alignItems: "center" }}>
              <Text style={styles.headerTitle}>Calendar</Text>
              <Text style={styles.headerSub}>
                {months[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* DATE STRIP */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {weeks.map((week, wi) => (
              <View key={wi} style={{ width: WIDTH }}>
                <View style={styles.daysRow}>
                  {week.map((d) => {
                    const selected =
                      d.toDateString() === selectedDate.toDateString();

                    return (
                      <Pressable
                        key={d.toISOString()}
                        onPress={() => setSelectedDate(new Date(d))}
                        style={[
                          styles.dayPill,
                          selected && styles.daySelected,
                        ]}
                      >
                        <Text style={[styles.dayName, selected && styles.dayActiveText]}>
                          {dayNames[d.getDay()]}
                        </Text>
                        <Text style={[styles.dayNumber, selected && styles.dayActiveText]}>
                          {d.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* CONTENT */}
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator size="large" color="#1E4DB3" />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : meetings.length === 0 ? (
              <Text style={styles.empty}>No meetings planned</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {meetings.map((m, i) => (
                  <View
                    key={m.post_plan_id ?? i}
                    style={[styles.card, getCardStyle(m.callstatus)]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customer}>{m.customer}</Text>

                      <Text style={styles.meta}>🆔 Customer ID: {m.customer_id}</Text>

                      <Text style={styles.meta}>
                        🕒 {m.plan_time && m.plan_time !== " - "
                          ? m.plan_time
                          : "Time not specified"}
                      </Text>

                      <Text style={styles.meta}>
                        📌 Mode: {m.plan_mode || "N/A"}
                      </Text>

                      <View
                        style={[
                          styles.statusBadge,
                          getStatusBadgeStyle(m.callstatus),
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {m.callstatus ? m.callstatus.toUpperCase() : "UNKNOWN"}
                        </Text>
                      </View>
                      {/* ACTION BUTTONS */}
<View style={styles.actionRow}>
  {/* EDIT BUTTON */}
<Pressable
  style={styles.editBtn}
  onPress={() =>
    router.push({
      pathname: "/(tabs)/edit-meeting",
      params: {
        meeting: JSON.stringify(m),
        meetingDate: getKey(selectedDate),
      },
    })
  }
>
  <Ionicons name="create-outline" size={16} color="#2563EB" />
  <Text style={styles.editText}>Edit</Text>
</Pressable>


  <Pressable
    style={styles.deleteBtn}
    onPress={() => handleDelete(m.post_plan_id)}
  >
    <Ionicons name="trash-outline" size={16} color="#DC2626" />
    <Text style={styles.deleteText}>Delete</Text>
  </Pressable>
</View>

                    </View>

                    <View style={m.ai_generated ? styles.ai : styles.manual}>
                      <Text style={styles.badge}>
                        {m.ai_generated ? "AI" : "Manual"}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* FAB */}
          <Pressable
            style={styles.fab}
            onPress={() => router.push("/(tabs)/add-plan-screen")}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </Pressable>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f4f4fa",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },

  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0c0c0e" },
  headerSub: { fontSize: 13, color: "#30373f", fontWeight: "600" },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#051539",
    justifyContent: "center",
    alignItems: "center",
  },

  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },

  dayPill: {
    width: 44,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071b52",
  },

  daySelected: { backgroundColor: "#6b7ca4" },
  dayName: { fontSize: 11, color: "#aba4a4" },
  dayNumber: { fontSize: 16, fontWeight: "800", color: "#fff" },
  dayActiveText: { color: "#fff" },

  content: {
    flex: 25,
    backgroundColor: "#e5e5e5",
    borderRadius: 26,
    padding: 14,
  },

  card: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },

  cardMet: {
    backgroundColor: "#E6F7EF",
    borderLeftWidth: 5,
    borderLeftColor: "#16A34A",
  },
 actionRow: {
  flexDirection: "row",
  marginTop: 10,
  gap: 12,
},

editBtn: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#E0ECFF",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
},

deleteBtn: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FEE2E2",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
},

editText: {
  marginLeft: 6,
  fontSize: 13,
  fontWeight: "700",
  color: "#2563EB",
},

deleteText: {
  marginLeft: 6,
  fontSize: 13,
  fontWeight: "700",
  color: "#DC2626",
},

  cardNotMet: {
    backgroundColor: "#FDECEC",
    borderLeftWidth: 5,
    borderLeftColor: "#DC2626",
  },

  cardDefault: {
    backgroundColor: "#F9FBFF",
  },

  customer: { fontSize: 16, fontWeight: "800", color: "#15314a" },
  meta: { fontSize: 13, color: "#6b7c93", marginTop: 4 },

  ai: {
    backgroundColor: "#E4ECFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "center",
  },

  manual: {
    backgroundColor: "#FFEFD6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "center",
  },

  badge: { fontSize: 12, fontWeight: "800" },

  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  statusMet: { backgroundColor: "#16A34A" },
  statusNotMet: { backgroundColor: "#DC2626" },
  statusDefault: { backgroundColor: "#6B7280" },

  statusText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0e2046",
    justifyContent: "center",
    alignItems: "center",
  },

  error: { color: "red", textAlign: "center" },
  empty: { color: "#777", textAlign: "center", marginTop: 20 },
});
