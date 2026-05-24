// screens/MyCompetitionsScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const FILTERS = ["Sve", "Nauka", "Sport"];

const MyCompetitionsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Sve");
  const [competitions, setCompetitions] = useState([]);
  const [enabledNotifications, setEnabledNotifications] = useState({});

  const fetchCompetitions = async () => {
    if (!user?.token) return;
    try {
      const res = await apiClient.get("/my-competitions", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setCompetitions(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Error loading my competitions:", e?.response?.data || e?.message);
      setCompetitions([]);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchCompetitions().finally(() => setIsLoading(false));
  }, [user?.token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCompetitions().finally(() => setRefreshing(false));
  }, [user?.token]);

  const filtered = useMemo(() => {
    if (selectedFilter === "Sve") return competitions;
    return competitions.filter((c) => c?.type === selectedFilter);
  }, [competitions, selectedFilter]);

  const formatDateTime = (isoString) => {
    try {
      const d = new Date(isoString);
      const date = d.toLocaleDateString("sr-Latn-BA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const time = d.toLocaleTimeString("sr-Latn-BA", { hour: "2-digit", minute: "2-digit" });
      return { date, time };
    } catch {
      return { date: "", time: "" };
    }
  };

  const typeIcon = (type) => {
    if (type === "Sport") return { name: "football", color: "#10345bff" };
    if (type === "Nauka") return { name: "flask", color: "#10345bff" };
    return { name: "trophy-outline", color: "#10345bff" };
  };

  const toggleNotification = (key) => {
    setEnabledNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    // TODO: Integracija sa backendom kad endpoint za obavještenja bude spreman.
  };

  const isCompetitionFinished = (startDate) => {
    try {
      const competitionDate = new Date(startDate);
      const now = new Date();
      return competitionDate < now;
    } catch {
      return false;
    }
  };

  const renderCard = (item, idx) => {
    const { date, time } = formatDateTime(item.startDate);
    const icon = typeIcon(item.type);
    const notifKey = `${item.competitionName}-${item.startDate}`;
    const notifEnabled = !!enabledNotifications[notifKey];
    const finished = isCompetitionFinished(item.startDate);
    const canShowResults = finished && item.type === "Nauka" && item.competitionId;
    return (
      <View key={`${item.competitionName}-${idx}`} style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon.name} size={22} color={icon.color} />
          <Text style={styles.title} numberOfLines={1}>
            {item.competitionName}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color="#10345bff" />
          <Text style={styles.infoText}>{date}</Text>
          {!!time && <Text style={[styles.infoText, styles.dotSep]}>•</Text>}
          {!!time && <Text style={styles.infoText}>{time}</Text>}
        </View>

        {!!item.location && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#10345bff" />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          {canShowResults && (
            <TouchableOpacity
              style={styles.resultsBtn}
              onPress={() => navigation.navigate('MyCompetitionsResults', {
                competitionId: item.competitionId,
                competitionName: item.competitionName
              })}
            >
              <Ionicons
                name="trophy"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.resultsBtnText}>Pogledaj bodove</Text>
            </TouchableOpacity>
          )}
          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={[styles.notifyBtn, notifEnabled && styles.notifyBtnActive]}
              onPress={() => toggleNotification(notifKey)}
            >
              <Ionicons
                name={notifEnabled ? "notifications" : "notifications-outline"}
                size={16}
                color={notifEnabled ? "#fff" : "#10345bff"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.notifyBtnText, notifEnabled && styles.notifyBtnTextActive]}>
                {notifEnabled ? "Obavještenja uključena" : "Uključi obavještenja"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setSelectedFilter(f)}
              style={[styles.filterBtn, selectedFilter === f && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, selectedFilter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#10345bff" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nema prijavljenih takmičenja</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>{filtered.map(renderCard)}</View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  filterBar: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  filterBtnActive: { backgroundColor: "#10345bff", borderColor: "#10345bff" },
  filterText: { fontSize: 14, color: "#666", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flex: 1 },
  listWrap: { padding: 15, paddingBottom: 30 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 10,
    marginBottom: 10,
    gap: 10,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "bold", color: "#333" },
  typeBadge: {
    backgroundColor: "#fa8d10ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  infoText: { fontSize: 14, color: "#333" },
  dotSep: { marginHorizontal: 2, color: "#777" },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#7d7c7cff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryBtnText: { color: "#7d7c7cff", fontWeight: "600", fontSize: 12 },
  resultsBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fa8d10ff",
  },
  resultsBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  notifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#10345bff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  notifyBtnActive: {
    backgroundColor: "#10345bff",
  },
  notifyBtnText: {
    color: "#10345bff",
    fontWeight: "600",
    fontSize: 12,
  },
  notifyBtnTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyText: { marginTop: 12, fontSize: 16, color: "#999" },
});

export default MyCompetitionsScreen;
