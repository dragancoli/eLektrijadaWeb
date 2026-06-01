import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import StatCard from "../../components/stats/StatCard";
import SectionTabs from "../../components/stats/SectionTabs";
import SimpleBarChart from "../../components/stats/SimpleBarChart";
import SimpleDonutChart from "../../components/stats/SimpleDonutChart";
import RankingList from "../../components/stats/RankingList";
import { exportOrganizerStatsPdf } from "../../utils/exportOrganizerStatsPdf";


const TABS = [
  { key: "faculties", label: "Fakulteti", icon: "school-outline" },
  { key: "matches", label: "Mečevi", icon: "football-outline" },
  { key: "ranking", label: "Rang lista", icon: "trophy-outline" },
  { key: "disciplines", label: "Discipline", icon: "grid-outline" },
  { key: "overview", label: "Pregled", icon: "pie-chart-outline" },
];

const OrganizerStatsScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("faculties");
  const [disciplineFilter, setDisciplineFilter] = useState("sport");
  const [exporting, setExporting] = useState(false);

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
      const res = await apiClient.get("/statistics/organizer", {
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

  const handleExportPdf = async () => {
    if (!stats) return;
    try {
      setExporting(true);
      await exportOrganizerStatsPdf(stats, selectedYear);
    } catch (err) {
      Alert.alert("Greška", "PDF nije mogao biti generisan. Pokušajte ponovo.");
    } finally {
      setExporting(false);
    }
  };

  if (!stats && loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10345bff" />
        <Text style={styles.loadingText}>Učitavanje statistika...</Text>
      </View>
    );
  }

  const kpi = stats?.kpiCards || {};

  const getFilteredDisciplines = () => {
    const all = stats?.competitionsByDiscipline || [];
    if (disciplineFilter === "sport") return all.filter((r) => r.type === "Sport");
    return all.filter((r) => r.type === "Nauka");
  };

  const getFilterLabel = () => {
    return disciplineFilter === "sport" ? "Sport" : "Nauka";
  };

  const renderDisciplineToggle = () => (
    <View style={styles.toggleRow}>
      {[
        { key: "sport", label: "Sport", icon: "football-outline" },
        { key: "science", label: "Nauka", icon: "flask-outline" },
      ].map((btn) => (
        <TouchableOpacity
          key={btn.key}
          style={[
            styles.toggleBtn,
            disciplineFilter === btn.key && styles.toggleBtnActive,
          ]}
          onPress={() => setDisciplineFilter(btn.key)}
        >
          <Ionicons
            name={btn.icon}
            size={16}
            color={disciplineFilter === btn.key ? "#fff" : "#10345bff"}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.toggleBtnText,
              disciplineFilter === btn.key && styles.toggleBtnTextActive,
            ]}
          >
            {btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSection = () => {
    switch (activeTab) {
      case "faculties":
        return (
          <SimpleBarChart
            title="Timovi po fakultetima"
            data={(stats?.teamsByFaculty || []).map((r) => ({
              label: r.faculty_name, value: Number(r.team_count),
            }))}
            barColor="#10345bff"
          />
        );
      case "matches":
        return (
          <SimpleDonutChart
            title="Status mečeva"
            data={(stats?.matchStatuses || []).map((r) => ({
              label: r.Status, value: Number(r.count),
            }))}
          />
        );
      case "ranking":
        return (
          <RankingList
            title="Rang lista fakulteta"
            data={(stats?.facultyRanking || []).map((r, i) => ({
              name: r.faculty_name, subtitle: r.city,
              value: Number(r.score), position: i + 1,
            }))}
            valueLabel="bodova"
          />
        );
      case "disciplines":
        return (
          <View>
            {renderDisciplineToggle()}
            <SimpleBarChart
              title={`Timovi po disciplinama – ${getFilterLabel()} (${selectedYear})`}
              data={getFilteredDisciplines().map((r) => ({
                label: r.name,
                value: Number(r.team_count),
              }))}
              barColor={
                disciplineFilter === "sport" ? "#10345bff" : "#fa8d10ff"
              }
            />
          </View>
        );
      case "overview":
        return (
          <SimpleDonutChart
            title={`Raspodjela timova (${selectedYear})`}
            data={(stats?.sportVsScienceTeams || []).map((r) => ({
              label: r.type, value: Number(r.team_count),
            }))}
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
        <View style={styles.headerLeft}>
          <Ionicons name="stats-chart" size={28} color="#fa8d10ff" />
          <Text style={styles.headerTitle}>Statistike organizatora</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExportPdf}
          disabled={exporting || !stats}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={18} color="#fff" />
          )}
          <Text style={styles.exportBtnText}>
            {exporting ? "Izvoz..." : "PDF"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Year Picker */}
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

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <StatCard icon="football-outline" label="Sportska" value={kpi.sportCompetitions} color="#10345bff" />
        <StatCard icon="flask-outline" label="Naučna" value={kpi.scienceCompetitions} color="#4CAF50" />
      </View>
      <View style={styles.kpiRow}>
        <StatCard icon="people-outline" label="Korisnici" value={kpi.totalUsers} color="#9C27B0" />
        <StatCard icon="shield-outline" label="Timovi" value={kpi.totalTeams} color="#fa8d10ff" />
      </View>

      {/* Section Tabs */}
      <SectionTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} accentColor="#10345bff" />

      {/* Active Section Content */}
      {renderSection()}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10345bff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    minWidth: 80,
    justifyContent: "center",
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  yearRow: { marginBottom: 14 },
  yearBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  yearBtnActive: { backgroundColor: "#10345bff", borderColor: "#10345bff" },
  yearText: { fontSize: 14, color: "#666", fontWeight: "500" },
  yearTextActive: { color: "#fff", fontWeight: "700" },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  loadingOverlay: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#10345b15", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 12 },
  loadingOverlayText: { marginLeft: 8, fontSize: 13, color: "#10345bff", fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
    gap: 8,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#10345bff",
  },
  toggleBtnActive: {
    backgroundColor: "#10345bff",
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10345bff",
  },
  toggleBtnTextActive: {
    color: "#fff",
  },
});

export default OrganizerStatsScreen;