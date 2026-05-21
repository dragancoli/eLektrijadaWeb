// screens/AllResultsScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";

const AllResultsScreen = ({ route }) => {
  const { competitionId, competitionName } = route.params;
  const [results, setResults] = useState([]);
  const [competition, setCompetition] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/public-competitions/${competitionId}/all-results`);
      setCompetition(response.data.competition);
      setResults(response.data.results);
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchResults();
    } catch (error) {
      console.error("Error refreshing results:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getMedalColor = (rang) => {
    if (rang === 1) return "#FFD700"; // Gold
    if (rang === 2) return "#C0C0C0"; // Silver
    if (rang === 3) return "#CD7F32"; // Bronze
    return "#e0e0e0";
  };

  const renderResultRow = (rezultat) => {
    const isTopThree = rezultat.rang <= 3;
    
    return (
      <View key={rezultat.id} style={[styles.resultRow, isTopThree && styles.resultRowTopThree]}>
        <View style={[styles.rankBadge, { backgroundColor: getMedalColor(rezultat.rang) }]}>
          <Text style={styles.rankText}>{rezultat.rang}</Text>
        </View>
        
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {rezultat.ime_studenta} {rezultat.prezime_studenta}
          </Text>
          <Text style={styles.facultyName}>{rezultat.fakultet}</Text>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{rezultat.broj_bodova}</Text>
          <Text style={styles.scoreLabel}>bodova</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="trophy" size={24} color="#10345bff" />
        <Text style={styles.headerTitle}>{competitionName || competition?.naziv_predmeta}</Text>
      </View>

      {/* Results List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10345bff"]}
            tintColor="#10345bff"
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 50 }} />
        ) : results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Nema dostupnih rezultata</Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {results.map((rezultat) => renderResultRow(rezultat))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  resultsContainer: {
    padding: 15,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultRowTopThree: {
    borderLeftWidth: 4,
    borderLeftColor: "#10345bff",
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  facultyName: {
    fontSize: 13,
    color: "#666",
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10345bff",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#999",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: "#999",
  },
});

export default AllResultsScreen;
