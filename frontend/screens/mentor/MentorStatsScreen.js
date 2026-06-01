import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import StatCard from "../../components/stats/StatCard";
import SectionTabs from "../../components/stats/SectionTabs";
import VerticalBarChart from "../../components/stats/VerticalBarChart";
import RankingList from "../../components/stats/RankingList";
import SimpleBarChart from "../../components/stats/SimpleBarChart";
import { exportMentorStatsPdf } from "../../utils/exportMentorStatsPdf";

const TABS = [
  { key: "scores", label: "Bodovi", icon: "bar-chart-outline" },
  { key: "distribution", label: "Raspodjela", icon: "stats-chart-outline" },
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
  const [exporting, setExporting] = useState(false);
  const [selectedDistId, setSelectedDistId] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/statistics/mentor", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = res.data;
      setStats(data);
      if (data.scoreDistributions?.length > 0) {
        setSelectedDistId(data.scoreDistributions[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchStats(); setRefreshing(false);
  }, []);

  const handleExportPdf = async () => {
    if (!stats) return;
    setExporting(true);
    try {
      await exportMentorStatsPdf(stats);
    } catch (error) {
      Alert.alert("Greška", "Nije uspjelo generisanje PDF-a.");
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
      case "distribution": {
        const dists = stats?.scoreDistributions || [];
        if (dists.length === 0) {
          return (
            <View style={styles.emptySection}>
              <Ionicons name="stats-chart-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>Nema podataka o raspodjeli</Text>
            </View>
          );
        }

        const activeDist = dists.find((d) => d.id === selectedDistId) || dists[0];
        const data = [
          { label: "0-9", value: Number(activeDist.range_0_9) || 0 },
          { label: "10-19", value: Number(activeDist.range_10_19) || 0 },
          { label: "20-29", value: Number(activeDist.range_20_29) || 0 },
          { label: "30-39", value: Number(activeDist.range_30_39) || 0 },
          { label: "40-49", value: Number(activeDist.range_40_49) || 0 },
          { label: "50-59", value: Number(activeDist.range_50_59) || 0 },
          { label: "60-69", value: Number(activeDist.range_60_69) || 0 },
          { label: "70-79", value: Number(activeDist.range_70_79) || 0 },
          { label: "80-89", value: Number(activeDist.range_80_89) || 0 },
          { label: "90-100", value: Number(activeDist.range_90_100) || 0 },
        ];

        return (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {dists.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chipBtn, selectedDistId === d.id && styles.chipBtnActive]}
                  onPress={() => setSelectedDistId(d.id)}
                >
                  <Text style={[styles.chipText, selectedDistId === d.id && styles.chipTextActive]}>
                    {labelWithYear(d.competition_name, d.year)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <VerticalBarChart
              title={`Raspodjela bodova (${labelWithYear(activeDist.competition_name, activeDist.year)})`}
              data={data}
              barColor="#9C27B0"
            />
          </View>
        );
      }
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="school" size={28} color="#FF9800" />
          <Text style={styles.headerTitle}>Moje statistike</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginLeft: 10 },
  exportBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FF9800", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 13, marginLeft: 6 },
  kpiRow: { flexDirection: "row", marginBottom: 4 },
  emptySection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 16, marginBottom: 16 },
  emptyText: { marginTop: 8, fontSize: 13, color: "#aaa" },
  chipRow: { marginBottom: 14 },
  chipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginRight: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  chipBtnActive: { backgroundColor: "#9C27B0", borderColor: "#9C27B0" },
  chipText: { fontSize: 13, color: "#666", fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  statusSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  statusCard: { backgroundColor: "#fafafa", borderRadius: 12, padding: 12, marginBottom: 8 },
  statusName: { fontSize: 14, fontWeight: "600", color: "#1a1a2e", marginBottom: 8 },
  statusRow: { flexDirection: "row", justifyContent: "space-around" },
  statusItem: { flexDirection: "row", alignItems: "center" },
  statusLabel: { fontSize: 12, color: "#666", marginLeft: 6 },
});

export default MentorStatsScreen;
