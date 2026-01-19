import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
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
import aiApi from "../hooks/aiApi";

/* ================= BACKGROUND ================= */
const BG_IMAGE = require("../../assets/images/bg.png");

/* ================= HELPERS ================= */
const pad = (n: number) => String(n).padStart(2, "0");
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
    case "met": return styles.cardMet;
    case "not met": return styles.cardNotMet;
    default: return styles.cardDefault;
  }
};

const getStatusBadgeStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "met": return styles.statusMet;
    case "not met": return styles.statusNotMet;
    default: return styles.statusDefault;
  }
};

/* ================= COMPONENT ================= */
export default function CalendarScreen() {
  const router = useRouter();
  const WIDTH = Dimensions.get("window").width - 32;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) throw new Error("User ID missing");

      const resp = await aiApi.get("/calendar/view", {
        params: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          user_id: userId,
        },
      });

      const calendar = resp.data?.calendar_meetings || {};
      const data = Array.isArray(calendar[key]) ? calendar[key] : [];
      setMeetings(data);
    } catch (err) {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMeetings(selectedDate);
    }, [fetchMeetings, selectedDate])
  );

  /* ================= DELETE ================= */
  const deleteMeeting = async (postPlanId: string, prePlanId?: string) => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem("crmUserId");
      if (!userId) {
        Alert.alert("Error", "User ID not found");
        return;
      }
      const planId = prePlanId || postPlanId;
      await aiApi.delete("/calendar/delete-meeting", {
        params: {
          pre_plan_id: planId,
          user_id: userId.toUpperCase(),
        },
      });
      await fetchMeetings(selectedDate);
    } catch {
      Alert.alert("Error", "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (postPlanId: string, prePlanId?: string) => {
    Alert.alert("Delete Meeting", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMeeting(postPlanId, prePlanId),
      },
    ]);
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
          <View style={{ marginBottom: 16 }}>
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
                      const selected = d.toDateString() === selectedDate.toDateString();
                      return (
                        <Pressable
                          key={d.toISOString()}
                          onPress={() => {
                            const nd = new Date(d);
                            setSelectedDate(nd);
                            fetchMeetings(nd);
                          }}
                          style={[styles.dayPill, selected && styles.daySelected]}
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
          </View>

          {/* QUICK ACTION BUTTON */}
          <View style={styles.actionButtonContainer}>
            <Pressable
              style={[styles.quickActionBtn, { backgroundColor: "#1E4DB3" }]}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/add-plan-screen",
                  params: { date: getKey(selectedDate) },
                })
              }
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.quickActionText}>Add Plan</Text>
            </Pressable>
          </View>

          {/* CONTENT */}
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator size="large" color="#1E4DB3" style={{ marginTop: 20 }} />
            ) : meetings.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="calendar-outline" size={48} color="#aaa" />
                <Text style={styles.empty}>No meetings planned</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {meetings.map((m, index) => (
                  <View
                    key={`${m.pre_plan_id ?? 'pre'}-${m.post_plan_id ?? 'post'}-${index}`}
                    style={[styles.card, getCardStyle(m.callstatus)]}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.customer} numberOfLines={1}>{m.customer}</Text>
                      <View style={[styles.statusBadge, getStatusBadgeStyle(m.callstatus)]}>
                        <Text style={styles.statusText}>
                          {m.callstatus?.toUpperCase() || "PLAN"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.metaContainer}>
                      <View style={styles.metaRow}>
                        <Ionicons name="finger-print" size={14} color="#555" />
                        <Text style={styles.metaText}>ID: {m.customer_id}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={14} color="#555" />
                        <Text style={styles.metaText}>{m.plan_time || "N/A"}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={14} color="#555" />
                        <Text style={styles.metaText}>{m.plan_mode}</Text>
                      </View>
                    </View>

                    <View style={styles.footerRow}>
                      <View style={styles.actionRow}>
                        <Pressable
                          style={styles.editBtn}
                          onPress={() =>
                            router.push({
                              pathname: "/(tabs)/add-plan-screen",
                              params: {
                                pre_plan_id: String(m.pre_plan_id ?? ""),
                                meeting: JSON.stringify(m),
                                date: getKey(selectedDate),
                                plan_mode: String(m.plan_mode ?? ""),
                              },
                            })
                          }
                        >
                          <Ionicons name="create-outline" size={16} color="#2563EB" />
                          <Text style={styles.editText}>Edit</Text>
                        </Pressable>

                        <Pressable
                          style={styles.deleteBtn}
                          onPress={() => handleDelete(m.post_plan_id, m.pre_plan_id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          <Text style={styles.deleteText}>Delete</Text>
                        </Pressable>
                      </View>

                      {m.callstatus?.toLowerCase() === "not met" && (
                        <Pressable
                          style={styles.convertBtn}
                          onPress={() =>
                            router.push({
                              pathname: "/(tabs)/meeting-entry",
                              params: {
                                meetingDate: getKey(selectedDate),
                                postPlanId: m.post_plan_id,
                                pre_plan_id: m.pre_plan_id ?? "",
                                customer_id: m.customer_id ?? "",
                                customer: m.customer ?? "",
                                plan_time: m.plan_time ?? "",
                                plan_mode: m.plan_mode ?? "",
                                remarks: m.remarks ?? "",
                                callstatus: m.callstatus ?? "",
                                meeting: JSON.stringify(m),
                              },
                            })
                          }
                        >
                          <Ionicons name="mic-outline" size={18} color="#065F46" />
                          <Text style={styles.convertText}>Convert to Meeting</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
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
    marginBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: '#051539' },
  headerSub: { fontSize: 13, color: "#555", fontWeight: '500' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#051539", alignItems: "center", justifyContent: "center",
  },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayPill: {
    width: 44, height: 58, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#071b52",
  },
  daySelected: { backgroundColor: "#6b7ca4" },
  dayName: { fontSize: 11, color: "#ccc", marginBottom: 2 },
  dayNumber: { fontSize: 16, fontWeight: "800", color: "#fff" },
  dayActiveText: { color: "#fff" },
  
  actionButtonContainer: {
    marginBottom: 16,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  quickActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  content: {
    flex: 1, 
    backgroundColor: "#e5e5e5",
    borderRadius: 26, 
    padding: 16,
  },
  card: { 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardMet: { backgroundColor: "#E6F7EF" },
  cardNotMet: { backgroundColor: "#FDECEC" },
  cardDefault: { backgroundColor: "#F9FBFF" },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customer: { fontSize: 17, fontWeight: "800", color: '#051539', flex: 1, marginRight: 8 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 12 },
  metaContainer: { marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaText: { fontSize: 13, marginLeft: 8, color: "#444", fontWeight: '500' },
  footerRow: { gap: 8 },
  actionRow: { flexDirection: "row", gap: 10 },
  editBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: 'center',
    backgroundColor: "#E0ECFF", paddingVertical: 10, borderRadius: 12,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: 'center',
    backgroundColor: "#FEE2E2", paddingVertical: 10, borderRadius: 12,
  },
  editText: { marginLeft: 6, color: "#2563EB", fontWeight: "700" },
  deleteText: { marginLeft: 6, color: "#DC2626", fontWeight: "700" },
  convertBtn: {
    flexDirection: "row",
    backgroundColor: "#D1FAE5", padding: 12, borderRadius: 12,
    alignItems: "center", justifyContent: 'center',
  },
  convertText: { marginLeft: 8, fontWeight: "800", color: "#065F46" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusMet: { backgroundColor: "#16A34A" },
  statusNotMet: { backgroundColor: "#DC2626" },
  statusDefault: { backgroundColor: "#6B7280" },
  statusText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  empty: { textAlign: "center", marginTop: 12, color: "#777", fontWeight: '500' },
});