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
import VerticalBarChart from "../../components/stats/VerticalBarChart";
import SimpleDonutChart from "../../components/stats/SimpleDonutChart";
import { exportSportStatsPdf } from "../../utils/exportSportStatsPdf";

const TABS = [
  { key: "sports", label: "Po sportovima", icon: "football-outline" },
  { key: "results", label: "Rezultati", icon: "list-outline" },
  { key: "faculties", label: "Fakulteti", icon: "school-outline" },
  { key: "status", label: "Status", icon: "pie-chart-outline" },
];

const SportStatsScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sports");
  const [sportFilter, setSportFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      const res = await apiClient.get("/statistics/sport-coordinator", {
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
    if (!stats || !selectedYear) return;
    setExporting(true);
    try {
      await exportSportStatsPdf(stats, selectedYear);
    } catch (error) {
      Alert.alert("Greška", "Nije uspjelo generisanje PDF-a.");
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

  const getUniqueSports = () => {
    const results = stats?.recentResults || [];
    const sports = new Set(results.map((r) => r.sport_name));
    return ["all", ...Array.from(sports)];
  };

  const getFilteredResults = () => {
    const results = stats?.recentResults || [];
    if (sportFilter === "all") return results;
    return results.filter((r) => r.sport_name === sportFilter);
  };

  const renderSportToggle = () => {
    const sports = getUniqueSports();
    if (sports.length <= 1) return null;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toggleRow}>
        {sports.map((sport) => (
          <TouchableOpacity
            key={sport}
            style={[
              styles.toggleBtn,
              sportFilter === sport && styles.toggleBtnActive,
            ]}
            onPress={() => setSportFilter(sport)}
          >
            <Text
              style={[
                styles.toggleBtnText,
                sportFilter === sport && styles.toggleBtnTextActive,
              ]}
            >
              {sport === "all" ? "Sve" : sport}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderSection = () => {
    switch (activeTab) {
      case "sports":
        return (
          <VerticalBarChart
            title="Broj prijavljenih timova po sportu"
            data={(stats?.teamsBySport || []).map((r) => ({
              label: r.sport_name, value: Number(r.team_count),
            }))}
            barColor="#E91E63"
          />
        );
      case "results": {
        if (!(stats?.recentResults?.length > 0)) {
          return (
            <View style={styles.emptySection}>
              <Ionicons name="football-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>Nema odigranih mečeva</Text>
            </View>
          );
        }

        const filteredResults = getFilteredResults();
        return (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Posljednji odigrani mečevi</Text>
            {renderSportToggle()}
            {filteredResults.length > 0 ? (
              filteredResults.map((m, i) => (
                <View key={i} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultSport}>{m.sport_name}</Text>
                    <Text style={styles.resultStage}>{m.Stage || "Završeno"}</Text>
                  </View>
                  <View style={styles.resultBody}>
                    <Text style={[styles.resultTeam, m.ResultTeam1 > m.ResultTeam2 && styles.resultWinner]}>{m.team1}</Text>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>{m.ResultTeam1} : {m.ResultTeam2}</Text>
                    </View>
                    <Text style={[styles.resultTeam, m.ResultTeam2 > m.ResultTeam1 && styles.resultWinner, { textAlign: "right" }]}>{m.team2}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Ionicons name="football-outline" size={40} color="#ccc" />
                <Text style={styles.emptyText}>Nema odigranih mečeva za izabrani sport</Text>
              </View>
            )}
          </View>
        );
      }
      case "faculties":
        return (
          <VerticalBarChart
            title="Angažman fakulteta (broj sportova)"
            data={(stats?.facultyEngagement || []).map((r) => ({
              label: r.faculty_name, value: Number(r.sport_count),
            }))}
            barColor="#4CAF50"
          />
        );
      case "status":
        return (
          <SimpleDonutChart
            title="Status mečeva"
            data={(stats?.matchStatuses || []).map((r) => ({
              label: r.Status, value: Number(r.count),
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="football" size={28} color="#E91E63" />
          <Text style={styles.headerTitle}>Statistike sporta</Text>
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
        <StatCard icon="apps-outline" label="Aktivni sportovi" value={kpi.activeSports} color="#E91E63" />
        <StatCard icon="football-outline" label="Ukupno mečeva" value={kpi.totalMatches} color="#10345bff" />
      </View>
      <View style={styles.kpiRow}>
        <StatCard icon="checkmark-done-outline" label="Odigrano" value={`${kpi.playedPercentage}%`} color="#4CAF50" />
        <StatCard icon="people-outline" label="Ukupno timova" value={kpi.totalTeams} color="#fa8d10ff" />
      </View>

      <SectionTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} accentColor="#E91E63" />
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
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  exportBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#E91E63", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 13, marginLeft: 6 },
  yearRow: { marginBottom: 14 },
  yearBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  yearBtnActive: { backgroundColor: "#10345bff", borderColor: "#10345bff" },
  yearText: { fontSize: 14, color: "#666", fontWeight: "500" },
  yearTextActive: { color: "#fff", fontWeight: "700" },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  loadingOverlay: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#10345b15", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 12 },
  loadingOverlayText: { marginLeft: 8, fontSize: 13, color: "#10345bff", fontWeight: "600" },
  emptySection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 16, marginBottom: 16 },
  emptyText: { marginTop: 8, fontSize: 13, color: "#aaa" },
  resultsSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  resultCard: { backgroundColor: "#fafafa", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 6 },
  resultSport: { fontSize: 12, color: "#E91E63", fontWeight: "700" },
  resultStage: { fontSize: 11, color: "#888", fontWeight: "600" },
  resultBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTeam: { flex: 1, fontSize: 13, color: "#333", fontWeight: "500" },
  resultWinner: { fontWeight: "800", color: "#1a1a2e" },
  scoreBadge: { backgroundColor: "#10345bff", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginHorizontal: 10 },
  scoreText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  toggleRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E91E63",
    marginRight: 8,
  },
  toggleBtnActive: {
    backgroundColor: "#E91E63",
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E91E63",
  },
  toggleBtnTextActive: {
    color: "#fff",
  },
});

export default SportStatsScreen;
