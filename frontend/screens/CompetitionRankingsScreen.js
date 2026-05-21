// screens/CompetitionRankingsScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";

const CompetitionRankingsScreen = ({ route, navigation }) => {
  const { competitionId, competitionName } = route.params || {};
  const [details, setDetails] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    fetchDetails();
    fetchTeams();
  }, [competitionId]);

  const fetchDetails = async () => {
    setLoadingDetails(true);
    try {
      const res = await apiClient.get(`/competitions/${competitionId}`);
      setDetails(res.data);
      // Postavi naslov ako nije došao iz parent-a
      if (!competitionName) {
        navigation.setOptions({ title: res.data.naziv_predmeta });
      } else {
        navigation.setOptions({ title: competitionName });
      }
    } catch (e) {
      console.error("Error loading competition details:", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchTeams = async () => {
    setLoadingTeams(true);
    try {
      const res = await apiClient.get(`/rankings/competitions/${competitionId}/teams`);
      setTeams(res.data);
    } catch (e) {
      console.error("Error loading team rankings:", e);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const renderTeamRow = ({ item, index }) => (
    <View style={styles.teamRow}>
      <Text style={styles.teamPos}>{index + 1}.</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.teamName}>{item.tim_naziv}</Text>
        <Text style={styles.facultyName}>{item.fakultet_naziv}</Text>
      </View>
      <View style={styles.pointsBox}>
        <Ionicons name="trophy-outline" size={16} color="#fff" />
        <Text style={styles.pointsText}>{Number(item.ukupno_bodova).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header sa detaljima */}
      <View style={styles.headerCard}>
        {loadingDetails ? (
          <ActivityIndicator size="small" color="#10345bff" />
        ) : details ? (
          <>
            <Text style={styles.title}>{details.naziv_predmeta}</Text>
            <Text style={styles.subtitle}>
              {details.opis || ""}{" "}
              {details.datum ? "• " + new Date(details.datum).toLocaleDateString("sr-Latn-BA") : ""}
            </Text>
          </>
        ) : (
          <Text style={styles.subtitle}>Takmičenje nije pronađeno</Text>
        )}
      </View>

      {/* Rang lista timova */}
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Ionicons name="podium-outline" size={20} color="#10345bff" />
          <Text style={styles.listTitle}>Rang lista timova</Text>
        </View>

        {loadingTeams ? (
          <ActivityIndicator size="small" color="#10345bff" style={{ marginVertical: 20 }} />
        ) : teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nema podataka</Text>
          </View>
        ) : (
          <FlatList
            data={teams}
            renderItem={renderTeamRow}
            keyExtractor={(item) => item.tim_id.toString()}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  headerCard: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#333" },
  subtitle: { marginTop: 6, color: "#666" },
  listCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  listHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  listTitle: { marginLeft: 8, fontSize: 16, fontWeight: "700", color: "#333" },
  teamRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  teamPos: { width: 28, textAlign: "center", fontWeight: "700", color: "#333" },
  teamName: { color: "#333", fontWeight: "700" },
  facultyName: { color: "#888", fontSize: 12, marginTop: 2 },
  pointsBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10345bff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pointsText: { marginLeft: 6, color: "#fff", fontWeight: "800" },
  separator: { height: 1, backgroundColor: "#f0f0f0" },
});

export default CompetitionRankingsScreen;
