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
import SimpleDonutChart from "../../components/stats/SimpleDonutChart";
import RankingList from "../../components/stats/RankingList";
import TimelineList from "../../components/stats/TimelineList";

const TABS = [
  { key: "positions", label: "Pozicije", icon: "trophy-outline" },
  { key: "verification", label: "Verifikacija", icon: "checkmark-circle-outline" },
  { key: "scores", label: "Bodovi", icon: "bar-chart-outline" },
  { key: "upcoming", label: "Nadolazeći", icon: "calendar-outline" },
];

const TeamLeaderStatsScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("positions");

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/statistics/team-leader", {
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
  const ver = stats?.verificationStatus || {};
  const teamsWithPosition = (stats?.teamPositions || []).filter((r) => r.position != null);
  const teamsWithoutPosition = (stats?.teamPositions || []).filter((r) => r.position == null);

  const renderSection = () => {
    switch (activeTab) {
      case "positions":
        return (
          <View>
            {teamsWithPosition.length > 0 && (
              <RankingList
                title="Pozicije mojih timova"
                data={teamsWithPosition.map((r) => ({
                  name: r.team_name,
                  subtitle: `${r.competition_name || r.type} • ${r.faculty_name}`,
                  value: `${r.position}. mj.`, position: r.position,
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
                      <Text style={styles.noPositionSub}>{r.competition_name || r.type} • {r.faculty_name}</Text>
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
                <Text style={styles.emptyText}>Nema podataka o timovima</Text>
              </View>
            )}
          </View>
        );
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
      case "scores":
        return stats?.teamScores?.length > 0 ? (
          <VerticalBarChart
            title="Bodovi po timu (nauka)"
            data={stats.teamScores.map((r) => ({
              label: r.team_name, value: Number(r.total_score),
            }))}
            barColor="#3F51B5"
          />
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="bar-chart-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>Nema podataka o bodovima</Text>
          </View>
        );
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
        <Ionicons name="people" size={28} color="#3F51B5" />
        <Text style={styles.headerTitle}>Statistike timova</Text>
      </View>

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
  header: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  emptySection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 16, marginBottom: 16 },
  emptyText: { marginTop: 8, fontSize: 13, color: "#aaa" },
  noPositionSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  noPositionCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginBottom: 6 },
  noPositionName: { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  noPositionSub: { fontSize: 11, color: "#888", marginTop: 2 },
  noPositionBadge: { backgroundColor: "#e0e0e0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  noPositionBadgeText: { fontSize: 10, fontWeight: "600", color: "#666" },
});

export default TeamLeaderStatsScreen;
