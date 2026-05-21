import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import StatCard from "../../components/stats/StatCard";
import SectionTabs from "../../components/stats/SectionTabs";
import VerticalBarChart from "../../components/stats/VerticalBarChart";
import RankingList from "../../components/stats/RankingList";

const TABS = [
  { key: "scores", label: "Bodovi", icon: "bar-chart-outline" },
  { key: "students", label: "Studenti", icon: "school-outline" },
  { key: "participants", label: "Učesnici", icon: "people-outline" },
  { key: "status", label: "Status", icon: "checkbox-outline" },
];

const labelWithYear = (name, year) => (year ? `${name} (${year})` : name);

const MentorStatsScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("scores");

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/statistics/mentor", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setStats(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchStats(); setRefreshing(false);
  }, []);

  if (loading && !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10345bff" />
        <Text style={styles.loadingText}>Učitavanje statistika...</Text>
      </View>
    );
  }

  const kpi = stats?.kpiCards || {};

  const renderSection = () => {
    switch (activeTab) {
      case "scores":
        return (
          <VerticalBarChart
            title="Prosjek bodova po takmičenju"
            data={(stats?.resultsByCompetition || []).map((r) => ({
              label: labelWithYear(r.competition_name, r.year),
              value: Number(r.avg_score) || 0,
            }))}
            barColor="#FF9800"
          />
        );
      case "students":
        return (
          <RankingList
            title="Top studenti po bodovima"
            data={(stats?.topStudents || []).map((r, i) => ({
              name: r.student_name, subtitle: r.faculty_name,
              value: Number(r.total_score), position: i + 1,
            }))}
            valueLabel="bodova"
          />
        );
      case "participants":
        return (stats?.resultsByCompetition || []).length > 0 ? (
          <VerticalBarChart
            title="Broj učesnika po takmičenju"
            data={(stats.resultsByCompetition).map((r) => ({
              label: labelWithYear(r.competition_name, r.year),
              value: Number(r.num_participants) || 0,
            }))}
            barColor="#10345bff"
          />
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="people-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>Nema podataka o učesnicima</Text>
          </View>
        );
      case "status":
        return stats?.competitionStatuses?.length > 0 ? (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Status takmičenja</Text>
            {stats.competitionStatuses.map((c, i) => (
              <View key={i} style={styles.statusCard}>
                <Text style={styles.statusName}>{labelWithYear(c.competition_name, c.year)}</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusItem}>
                    <Ionicons name={c.has_solution ? "checkmark-circle" : "close-circle"}
                      size={18} color={c.has_solution ? "#4CAF50" : "#E91E63"} />
                    <Text style={styles.statusLabel}>Rješenje</Text>
                  </View>
                  <View style={styles.statusItem}>
                    <Ionicons name={c.has_review ? "checkmark-circle" : "close-circle"}
                      size={18} color={c.has_review ? "#4CAF50" : "#E91E63"} />
                    <Text style={styles.statusLabel}>Termin uvida</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="clipboard-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>Nema podataka o statusu</Text>
          </View>
        );
      default: return null;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10345bff"]} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Ionicons name="school" size={28} color="#FF9800" />
        <Text style={styles.headerTitle}>Moje statistike</Text>
      </View>

      <View style={styles.kpiRow}>
        <StatCard icon="flask-outline" label="Takmičenja" value={kpi.competitions} color="#FF9800" />
        <StatCard icon="people-outline" label="Učesnici" value={kpi.participants} color="#10345bff" />
      </View>

      <SectionTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} accentColor="#FF9800" />
      {renderSection()}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  emptySection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 16, marginBottom: 16 },
  emptyText: { marginTop: 8, fontSize: 13, color: "#aaa" },
  statusSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  statusCard: { backgroundColor: "#fafafa", borderRadius: 12, padding: 12, marginBottom: 8 },
  statusName: { fontSize: 14, fontWeight: "600", color: "#1a1a2e", marginBottom: 8 },
  statusRow: { flexDirection: "row", justifyContent: "space-around" },
  statusItem: { flexDirection: "row", alignItems: "center" },
  statusLabel: { fontSize: 12, color: "#666", marginLeft: 6 },
});

export default MentorStatsScreen;
