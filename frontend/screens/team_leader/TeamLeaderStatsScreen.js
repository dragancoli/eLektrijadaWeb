import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import StatCard from "../../components/stats/StatCard";
import SectionTabs from "../../components/stats/SectionTabs";
import VerticalBarChart from "../../components/stats/VerticalBarChart";
import SimpleDonutChart from "../../components/stats/SimpleDonutChart";
import RankingList from "../../components/stats/RankingList";
import TimelineList from "../../components/stats/TimelineList";
import { exportTeamLeaderStatsPdf } from "../../utils/exportTeamLeaderStatsPdf";

const TABS = [
  { key: "teams", label: "Timovi", icon: "people-circle-outline" },
  { key: "verification", label: "Verifikacija", icon: "checkmark-circle-outline" },
  { key: "participants", label: "Učesnici", icon: "pie-chart-outline" },
  { key: "upcoming", label: "Nadolazeći", icon: "calendar-outline" },
];

const TeamLeaderStatsScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("teams");
  const [selectedComp, setSelectedComp] = useState(null);

  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
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
      const res = await apiClient.get("/statistics/team-leader", {
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

  const handleExport = async () => {
    if (!stats || !selectedYear) return;
    try {
      setExporting(true);
      await exportTeamLeaderStatsPdf(stats, selectedYear);
    } catch (error) {
      console.error("Greška pri exportu", error);
    } finally {
      setExporting(false);
    }
  };

  if (loading && !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10345bff" />
        <Text style={styles.loadingText}>Učitavanje statistika...</Text>
      </View>
    );
  }

  const kpi = stats?.kpiCards || {};
  const ver = stats?.verificationStatus || {};

  const renderSection = () => {
    switch (activeTab) {
      case "teams": {
        const allTeams = stats?.teamPositions || [];
        const comps = [...new Set(allTeams.map(t => t.competition_name).filter(Boolean))];
        const activeComp = selectedComp || comps[0];

        const filteredTeams = allTeams.filter(t => t.competition_name === activeComp);
        const teamsWithPosition = filteredTeams.filter((r) => r.position != null || r.Position != null);
        const teamsWithoutPosition = filteredTeams.filter((r) => r.position == null && r.Position == null);

        return (
          <View>
            {comps.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {comps.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.chipBtn, activeComp === c && styles.chipBtnActive]}
                    onPress={() => setSelectedComp(c)}
                  >
                    <Text style={[styles.chipText, activeComp === c && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {teamsWithPosition.length > 0 && (
              <RankingList
                title={`Pozicije timova (${activeComp})`}
                data={teamsWithPosition.map((r) => ({
                  name: r.team_name,
                  subtitle: `${r.faculty_name}`,
                  value: `${r.position || r.Position}. mj.`, position: r.position || r.Position,
                }))}
                showBar={false}
              />
            )}
            {teamsWithoutPosition.length > 0 && (
              <View style={styles.noPositionSection}>
                <Text style={styles.sectionTitle}>Timovi bez određene pozicije</Text>
                {teamsWithoutPosition.map((r, i) => (
                  <View key={i} style={styles.noPositionCard}>
                    <Ionicons name="remove-circle-outline" size={18} color="#aaa" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noPositionName}>{r.team_name}</Text>
                      <Text style={styles.noPositionSub}>{r.faculty_name}</Text>
                    </View>
                    <View style={styles.noPositionBadge}>
                      <Text style={styles.noPositionBadgeText}>{r.type}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {teamsWithPosition.length === 0 && teamsWithoutPosition.length === 0 && (
              <View style={styles.emptySection}>
                <Ionicons name="podium-outline" size={40} color="#ccc" />
                <Text style={styles.emptyText}>Nema timova za ovo takmičenje</Text>
              </View>
            )}
          </View>
        );
      }
      case "verification":
        return (
          <SimpleDonutChart
            title="Status verifikacije članova"
            data={[
              { label: "Verifikovani", value: Number(ver.verified) || 0, color: "#4CAF50" },
              { label: "Neverifikovani", value: Number(ver.unverified) || 0, color: "#FF9800" },
            ]}
          />
        );
      case "participants": {
        const colors = [
          "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5",
          "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50",
          "#8BC34A", "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800",
          "#FF5722", "#795548", "#9E9E9E", "#607D8B", "#880E4F"
        ];
        const data = (stats?.participantsByCompetition || []).map((r, i) => {
          return {
            label: r.competition_name,
            value: Number(r.participant_count),
            color: colors[i % colors.length],
          };
        });

        return data.length > 0 ? (
          <SimpleDonutChart
            title="Broj učesnika po takmičenju"
            data={data}
          />
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="pie-chart-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>Nema podataka o učesnicima</Text>
          </View>
        );
      }
      case "upcoming":
        return (
          <TimelineList
            title="Nadolazeći mečevi"
            data={(stats?.upcomingMatches || []).map((m) => ({
              title: `${m.team1} vs ${m.team2}`, subtitle: m.sport_name,
              date: m.StartDate, location: m.Location,
              badge: m.Stage || undefined,
            }))}
            accentColor="#3F51B5"
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
          <Ionicons name="people" size={28} color="#3F51B5" />
          <Text style={styles.headerTitle}>Statistike timova</Text>
        </View>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={exporting || !stats}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={16} color="#fff" />
              <Text style={styles.exportBtnText}>PDF</Text>
            </>
          )}
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
          <ActivityIndicator size="small" color="#3F51B5" />
          <Text style={styles.loadingOverlayText}>Učitavanje podataka za {selectedYear}...</Text>
        </View>
      )}

      <View style={styles.kpiRow}>
        <StatCard icon="shield-outline" label="Moji timovi" value={kpi.teams} color="#3F51B5" />
        <StatCard icon="people-outline" label="Članovi" value={kpi.members} color="#fa8d10ff" />
      </View>

      <SectionTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} accentColor="#3F51B5" />
      {renderSection()}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  exportBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#3F51B5", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  exportBtnText: { color: "#fff", fontWeight: "600", fontSize: 13, marginLeft: 6 },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  yearRow: { marginBottom: 14 },
  yearBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  yearBtnActive: { backgroundColor: "#3F51B5", borderColor: "#3F51B5" },
  yearText: { fontSize: 14, color: "#666", fontWeight: "500" },
  yearTextActive: { color: "#fff", fontWeight: "700" },
  loadingOverlay: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#3F51B515", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 12 },
  loadingOverlayText: { marginLeft: 8, fontSize: 13, color: "#3F51B5", fontWeight: "600" },
  emptySection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 16, marginBottom: 16 },
  emptyText: { marginTop: 8, fontSize: 13, color: "#aaa" },
  noPositionSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  noPositionCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginBottom: 6 },
  noPositionName: { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  noPositionSub: { fontSize: 11, color: "#888", marginTop: 2 },
  noPositionBadge: { backgroundColor: "#e0e0e0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  noPositionBadgeText: { fontSize: 10, fontWeight: "600", color: "#666" },
  chipRow: { marginBottom: 14 },
  chipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  chipBtnActive: { backgroundColor: "#3F51B5", borderColor: "#3F51B5" },
  chipText: { fontSize: 13, color: "#666", fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
});

export default TeamLeaderStatsScreen;
