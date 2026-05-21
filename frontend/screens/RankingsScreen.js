// screens/RankingsScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Platform, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import apiClient from "../api/client";

const TABS = ["Generalni plasman", "Sport", "Nauka"];

const RankingsScreen = ({ navigation }) => {
  const [selectedTab, setSelectedTab] = useState("Generalni plasman");
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  
  // General Faculty Rankings
  const [facultyRankings, setFacultyRankings] = useState([]);
  const [loadingFacultyRankings, setLoadingFacultyRankings] = useState(false);
  
  // Sport Competitions
  const [sportCompetitions, setSportCompetitions] = useState([]);
  const [selectedSportCompetition, setSelectedSportCompetition] = useState(null);
  const [sportRankings, setSportRankings] = useState([]);
  const [loadingSportCompetitions, setLoadingSportCompetitions] = useState(false);
  const [loadingSportRankings, setLoadingSportRankings] = useState(false);
  
  // Science Competitions
  const [scienceCompetitions, setScienceCompetitions] = useState([]);
  const [selectedScienceCompetition, setSelectedScienceCompetition] = useState(null);
  const [scienceRankings, setScienceRankings] = useState([]);
  const [loadingScienceCompetitions, setLoadingScienceCompetitions] = useState(false);
  const [loadingScienceRankings, setLoadingScienceRankings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchYears();
      if (selectedTab === "Generalni plasman") await fetchFacultyRankings();
      else if (selectedTab === "Sport") await fetchSportCompetitions();
      else if (selectedTab === "Nauka") await fetchScienceCompetitions();
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch available years on mount
  useEffect(() => {
    fetchYears();
  }, []);

  // Fetch data when year or tab changes
  useEffect(() => {
    if (!selectedYear) return;

    if (selectedTab === "Generalni plasman") {
      fetchFacultyRankings();
    } else if (selectedTab === "Sport") {
      fetchSportCompetitions();
    } else if (selectedTab === "Nauka") {
      fetchScienceCompetitions();
    }
  }, [selectedYear, selectedTab]);

  // Fetch sport rankings when competition is selected
  useEffect(() => {
    if (selectedSportCompetition) {
      fetchSportRankings();
    }
  }, [selectedSportCompetition]);

  // Fetch science rankings when competition is selected
  useEffect(() => {
    if (selectedScienceCompetition) {
      fetchScienceRankings();
    }
  }, [selectedScienceCompetition]);

  const fetchYears = async () => {
    try {
      const res = await apiClient.get("/rankings/years");
      setYears(res.data);
      if (res.data.length > 0) {
        setSelectedYear(res.data[0]); // Select most recent year
      }
    } catch (e) {
      console.error("Error loading years:", e);
    }
  };

  const fetchFacultyRankings = async () => {
    setLoadingFacultyRankings(true);
    try {
      const res = await apiClient.get("/rankings/faculty-ranking", { params: { year: selectedYear } });
      setFacultyRankings(res.data);
    } catch (e) {
      console.error("Error loading faculty rankings:", e);
      setFacultyRankings([]);
    } finally {
      setLoadingFacultyRankings(false);
    }
  };

  const fetchSportCompetitions = async () => {
    setLoadingSportCompetitions(true);
    try {
      const res = await apiClient.get("/rankings/sport-competitions", { params: { year: selectedYear } });
      setSportCompetitions(res.data);
      if (res.data.length > 0) {
        setSelectedSportCompetition(res.data[0].id);
      } else {
        setSelectedSportCompetition(null);
        setSportRankings([]);
      }
    } catch (e) {
      console.error("Error loading sport competitions:", e);
      setSportCompetitions([]);
      setSportRankings([]);
    } finally {
      setLoadingSportCompetitions(false);
    }
  };

  const fetchSportRankings = async () => {
    setLoadingSportRankings(true);
    try {
      const res = await apiClient.get(`/rankings/sport-competition/${selectedSportCompetition}`);
      setSportRankings(res.data.rankings || []);
    } catch (e) {
      console.error("Error loading sport rankings:", e);
      setSportRankings([]);
    } finally {
      setLoadingSportRankings(false);
    }
  };

  const fetchScienceCompetitions = async () => {
    setLoadingScienceCompetitions(true);
    try {
      const res = await apiClient.get("/rankings/science-competitions", { params: { year: selectedYear } });
      setScienceCompetitions(res.data);
      if (res.data.length > 0) {
        setSelectedScienceCompetition(res.data[0].id);
      } else {
        setSelectedScienceCompetition(null);
        setScienceRankings([]);
      }
    } catch (e) {
      console.error("Error loading science competitions:", e);
      setScienceCompetitions([]);
      setScienceRankings([]);
    } finally {
      setLoadingScienceCompetitions(false);
    }
  };

  const fetchScienceRankings = async () => {
    setLoadingScienceRankings(true);
    try {
      const res = await apiClient.get(`/rankings/science-competition/${selectedScienceCompetition}`);
      setScienceRankings(res.data.rankings || []);
    } catch (e) {
      console.error("Error loading science rankings:", e);
      setScienceRankings([]);
    } finally {
      setLoadingScienceRankings(false);
    }
  };

  const renderFacultyRankingItem = ({ item }) => (
    <View style={styles.rankingRow}>
      <View style={styles.positionBadge}>
        <Text style={styles.positionText}>{item.position}</Text>
      </View>
      <View style={styles.facultyInfo}>
        <Text style={styles.facultyName}>{item.faculty_name}</Text>
        <Text style={styles.facultyCity}>{item.city}</Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreValue}>{item.score}</Text>
        <Text style={styles.scoreLabel}>bodova</Text>
      </View>
    </View>
  );

  const renderCompetitionRankingItem = ({ item, isScience }) => (
    <View style={styles.rankingRow}>
      <View style={styles.positionBadge}>
        <Text style={styles.positionText}>{item.position}</Text>
      </View>
      <View style={styles.facultyInfo}>
        <Text style={styles.teamName}>{item.team_name}</Text>
        <Text style={styles.facultyCity}>{item.faculty_name} - {item.city}</Text>
      </View>
      {isScience && item.total_score !== undefined ? (
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>{Number(item.total_score).toFixed(2)}</Text>
          <Text style={styles.scoreLabel}>bodova</Text>
        </View>
      ) : null}
    </View>
  );

  const renderTabContent = () => {
    if (selectedTab === "Generalni plasman") {
      return (
        <View style={styles.content}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Godina:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedYear}
                onValueChange={(value) => setSelectedYear(value)}
                style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
                itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
              >
                {years.map((year) => (
                  <Picker.Item key={year} label={year.toString()} value={year} />
                ))}
              </Picker>
            </View>
          </View>

          {loadingFacultyRankings ? (
            <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 40 }} />
          ) : facultyRankings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nema podataka za {selectedYear}</Text>
            </View>
          ) : (
            <FlatList
              data={facultyRankings}
              renderItem={renderFacultyRankingItem}
              keyExtractor={(item, idx) => idx.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              style={styles.list}
            />
          )}
        </View>
      );
    }

    if (selectedTab === "Sport") {
      return (
        <View style={styles.content}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Godina:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedYear}
                onValueChange={(value) => setSelectedYear(value)}
                style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
                itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
              >
                {years.map((year) => (
                  <Picker.Item key={year} label={year.toString()} value={year} />
                ))}
              </Picker>
            </View>
          </View>

          {loadingSportCompetitions ? (
            <ActivityIndicator size="small" color="#10345bff" style={{ marginVertical: 20 }} />
          ) : sportCompetitions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="football-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nema sportskih takmičenja za {selectedYear}</Text>
            </View>
          ) : (
            <>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Takmičenje:</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedSportCompetition}
                    onValueChange={(value) => setSelectedSportCompetition(value)}
                    style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
                    itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
                  >
                    {sportCompetitions.map((comp) => (
                      <Picker.Item key={comp.id} label={comp.name} value={comp.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              {loadingSportRankings ? (
                <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 40 }} />
              ) : sportRankings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="trophy-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Nema podataka za ovo takmičenje</Text>
                </View>
              ) : (
                <FlatList
                  data={sportRankings}
                  renderItem={(props) => renderCompetitionRankingItem({ ...props, isScience: false })}
                  keyExtractor={(item, idx) => idx.toString()}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  style={styles.list}
                />
              )}
            </>
          )}
        </View>
      );
    }

    if (selectedTab === "Nauka") {
      return (
        <View style={styles.content}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Godina:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedYear}
                onValueChange={(value) => setSelectedYear(value)}
                style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
                itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
              >
                {years.map((year) => (
                  <Picker.Item key={year} label={year.toString()} value={year} />
                ))}
              </Picker>
            </View>
          </View>

          {loadingScienceCompetitions ? (
            <ActivityIndicator size="small" color="#10345bff" style={{ marginVertical: 20 }} />
          ) : scienceCompetitions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nema naučnih takmičenja za {selectedYear}</Text>
            </View>
          ) : (
            <>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Takmičenje:</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedScienceCompetition}
                    onValueChange={(value) => setSelectedScienceCompetition(value)}
                    style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
                    itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
                  >
                    {scienceCompetitions.map((comp) => (
                      <Picker.Item key={comp.id} label={comp.name} value={comp.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              {loadingScienceRankings ? (
                <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 40 }} />
              ) : scienceRankings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="trophy-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Nema podataka za ovo takmičenje</Text>
                </View>
              ) : (
                <FlatList
                  data={scienceRankings}
                  renderItem={(props) => renderCompetitionRankingItem({ ...props, isScience: true })}
                  keyExtractor={(item, idx) => idx.toString()}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  style={styles.list}
                />
              )}
            </>
          )}
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab selector */}
      <View style={styles.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.scrollView} 
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
        {renderTabContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  tabs: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    elevation: 2,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f2f2f2",
  },
  tabButtonActive: {
    backgroundColor: "#10345bff",
  },
  tabText: { color: "#333", fontWeight: "600", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    minHeight: 50,
  },
  pickerIOS: {
    height: 70,
    width: "100%",
  },
  pickerItemIOS: {
    height: 70,
  },
  pickerAndroid: {
    height: 50,
    width: "100%",
  },
  list: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  positionBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fa8d10ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  positionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  facultyInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  facultyName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  facultyCity: {
    fontSize: 12,
    color: "#999",
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#10345bff",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#999",
  },
  statsContainer: {
    alignItems: "flex-end",
  },
  statValue: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
    marginBottom: 2,
  },
  separator: {
    height: 1,
    backgroundColor: "#f5f5f5",
    marginVertical: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
});

export default RankingsScreen;
