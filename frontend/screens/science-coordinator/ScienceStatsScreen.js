import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import StatCard from "../../components/stats/StatCard";
import SectionTabs from "../../components/stats/SectionTabs";
import SimpleBarChart from "../../components/stats/SimpleBarChart";
import SimpleDonutChart from "../../components/stats/SimpleDonutChart";
import RankingList from "../../components/stats/RankingList";
import VerticalBarChart from "../../components/stats/VerticalBarChart";

const TABS = [
  { key: "scores", label: "Bodovi", icon: "bar-chart-outline" },
  { key: "teams", label: "Top timovi", icon: "trophy-outline" },
  { key: "solutions", label: "Rješenja", icon: "document-text-outline" },
  { key: "mentors", label: "Mentori", icon: "school-outline" },
];

const ScienceStatsScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("scores");

  useEffect(() => { fetchYears(); }, []);
  useEffect(() => { if (selectedYear) fetchStats(); }, [selectedYear]);

  const fetchYears = async () => {
    try {
      const res = await apiClient.get("/statistics/years");
      const y = res.data || [];
      setYears(y);
      if (y.length > 0) setSelectedYear(y[0]);
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/statistics/science-coordinator", {
        params: { year: selectedYear },
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setStats(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchStats(); setRefreshing(false);
  }, [selectedYear]);

  if (!stats && loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10345bff" />
        <Text style={styles.loadingText}>Učitavanje statistika...</Text>
      </View>
    );
  }

  const kpi = stats?.kpiCards || {};
  const sol = stats?.solutionStatus || {};

  const renderSection = () => {
    switch (activeTab) {
      case "scores":
        return (
          <VerticalBarChart
            title="Prosjek bodova po takmičenju"
            data={(stats?.avgScoreByCompetition || []).map((r) => ({
              label: r.competition_name, value: Number(r.avg_score),
            }))}
            barColor="#4CAF50"
          />
        );
      case "teams":
        return (
          <RankingList
            title="Top 5 timova po bodovima"
            data={(stats?.topTeams || []).map((r, i) => ({
              name: r.team_name, subtitle: r.faculty_name,
              value: Number(r.total_score), position: i + 1,
            }))}
            valueLabel="bodova"
          />
        );
      case "solutions":
        return (
          <SimpleDonutChart
            title="Status rješenja"
            data={[
              { label: "Sa rješenjem", value: Number(sol.with_solution) || 0, color: "#4CAF50" },
              { label: "Bez rješenja", value: Number(sol.without_solution) || 0, color: "#E91E63" },
            ]}
          />
        );
      case "mentors":
        return (
          <RankingList
            title="Mentori – broj takmičenja"
            data={(stats?.mentorOverview || []).map((r, i) => ({
              name: r.mentor_name, value: Number(r.comp_count), position: i + 1,
            }))}
            valueLabel="takmičenja"
          />
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
        <Ionicons name="flask" size={28} color="#4CAF50" />
        <Text style={styles.headerTitle}>Statistike nauke</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearRow}>
        {years.map((y) => (
          <TouchableOpacity key={y} style={[styles.yearBtn, selectedYear === y && styles.yearBtnActive]}
            onPress={() => setSelectedYear(y)}>
            <Text style={[styles.yearText, selectedYear === y && styles.yearTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && stats && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#10345bff" />
          <Text style={styles.loadingOverlayText}>Učitavanje podataka za {selectedYear}...</Text>
        </View>
      )}

      <View style={styles.kpiRow}>
        <StatCard icon="flask-outline" label="Takmičenja" value={kpi.scienceCompetitions} color="#4CAF50" />
        <StatCard icon="people-outline" label="Timovi" value={kpi.teams} color="#10345bff" />
      </View>
      <View style={styles.kpiRow}>
        <StatCard icon="person-outline" label="Učesnici" value={kpi.participants} color="#fa8d10ff" />
        <StatCard icon="document-text-outline" label="Sa rješenjem"
          value={`${Number(sol.with_solution) || 0}/${(Number(sol.with_solution) || 0) + (Number(sol.without_solution) || 0)}`}
          color="#9C27B0" />
      </View>

      <SectionTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} accentColor="#4CAF50" />
      {renderSection()}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  yearRow: { marginBottom: 14 },
  yearBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  yearBtnActive: { backgroundColor: "#10345bff", borderColor: "#10345bff" },
  yearText: { fontSize: 14, color: "#666", fontWeight: "500" },
  yearTextActive: { color: "#fff", fontWeight: "700" },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  loadingOverlay: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#10345b15", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 12 },
  loadingOverlayText: { marginLeft: 8, fontSize: 13, color: "#10345bff", fontWeight: "600" },
});

export default ScienceStatsScreen;
