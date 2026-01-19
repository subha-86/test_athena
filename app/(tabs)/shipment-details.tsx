import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ImageBackground } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import erpApi from "../hooks/erpApi";

const BG_IMAGE = require("../../assets/images/bg.png");

const ShipmentScreen = () => {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadShipments();
        }, [])
    );

    const loadShipments = async () => {
        try {
            setLoading(true);
            const userId = await AsyncStorage.getItem("userId");
            if (!userId) return;

            const res = await erpApi.get(
                "/Athena/feeder/mobileApp/getShipmentDetails",
                { params: { userId } }
            );

            setList(res.data.shipmentDetails || []);
        } catch (err) {
            console.log("Shipment Error", err);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.row}>
                <Text style={styles.label}>Job Date</Text>
                <Text style={styles.value}>{item.jobDate}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>JobNo</Text>
                <Text style={styles.value}>{item.jobNo}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Port</Text>
                <Text style={styles.value}>{item.polName}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>PodName</Text>
                <Text style={styles.value}>{item.podName}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Customername</Text>
                <Text style={styles.value}>{item.customername}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Status</Text>
                <Text style={[styles.value, styles.status]}>
                    {item.status}
                </Text>
            </View>
        </View>
    );

    if (loading) {
        return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
    }

    return (
        <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} >
            <SafeAreaView style={{ flex: 1, paddingTop: 25 }}>
                <View style={styles.container}>
                    {/* HEADER */}
                    <View style={headerStyles.headerBar}>
                        <Pressable onPress={() => router.back()} style={headerStyles.iconBtn}>
                            <Ionicons name="arrow-back" size={22} color="#fff" />
                        </Pressable>

                        <View style={{ alignItems: "center" }}>
                            <Text style={headerStyles.headerTitle}>Shipments Details</Text>
                        </View>

                        <View style={{ width: 40 }} />
                    </View>

                    {/* FLATLIST */}
                    <FlatList
                        data={list}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.container}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </SafeAreaView>
        </ImageBackground>
    );
};

export default ShipmentScreen;

const styles = StyleSheet.create({
    container: {
        padding: 12,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        elevation: 3, // Android shadow
        shadowColor: "#000", // iOS shadow
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#222",
    },
    value: {
        fontSize: 12,
        color: "#666",
    },
    status: {
        color: "#2E86DE",
        fontWeight: "900",
        fontSize: 14,
    },
});

const headerStyles = StyleSheet.create({
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
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#051539",
        justifyContent: "center",
        alignItems: "center",
    },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0c0c0e" },
  headerSub: { fontSize: 13, color: "#30373f", fontWeight: "600" },
});
