// screens/NotificationsModal.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

const { height } = Dimensions.get("window");

const NotificationsModal = ({ visible, onClose }) => {
  const [subscribedMatches, setSubscribedMatches] = useState([]);
  const [subscribedCompetitions, setSubscribedCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
      fetchSubscribedMatches();
      fetchSubscribedCompetitions();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const getPushToken = async () => {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return null;
      }
      try {
          const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
          if (!projectId) {
             token = (await Notifications.getExpoPushTokenAsync()).data;
          } else {
             token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          }
      } catch (e) {
          token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    }
    return token;
  };

  const fetchSubscribedMatches = async () => {
    setLoading(true);
    try {
      const token = await getPushToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // 1. Get subscribed match IDs
      const subsResponse = await apiClient.get(`/match-notifications/my-subscriptions/${token}`);
      const matchIds = subsResponse.data;

      if (matchIds.length === 0) {
        setSubscribedMatches([]);
        setLoading(false);
        return;
      }

      // 2. Fetch details for each match
      const matchesResponse = await apiClient.get("/public-sports/matches");
      const allMatches = matchesResponse.data;
      
      const filtered = allMatches.filter(m => matchIds.includes(m.IdMatch));
      setSubscribedMatches(filtered);

    } catch (error) {
      console.error("Error fetching subscribed matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribedCompetitions = async () => {
    try {
      const token = await getPushToken();
      if (!token) return;

      // Get subscribed competition IDs
      const subsResponse = await apiClient.get(`/competition-notifications/my-subscriptions/${token}`);
      const competitionIds = subsResponse.data;

      if (competitionIds.length === 0) {
        setSubscribedCompetitions([]);
        return;
      }

      // Fetch competitions for upcoming dates and filter
      const today = new Date();
      const dates = [];
      for (let i = -2; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }

      const allCompetitions = [];
      for (const date of dates) {
        try {
          const response = await apiClient.get(`/public-competitions/by-date?date=${date}`);
          allCompetitions.push(...response.data);
        } catch (err) {
          console.error(`Error fetching competitions for ${date}:`, err);
        }
      }

      const filtered = allCompetitions.filter(c => competitionIds.includes(c.id));
      setSubscribedCompetitions(filtered);

    } catch (error) {
      console.error("Error fetching subscribed competitions:", error);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const getStatusBadge = (status) => {
    if (status === "u_toku" || status === "U toku") {
      return { text: "UŽIVO", color: "#FF3B30", icon: "radio-button-on" };
    } else if (status === "zavrsena" || status === "Završeno") {
      return { text: "ZAVRŠENO", color: "#999", icon: "checkmark-circle" };
    }
    return { text: status, color: "#10345bff", icon: "time" };
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Moja Obavještenja</Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fa8d10ff" />
            </View>
          ) : subscribedMatches.length === 0 && subscribedCompetitions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>Nemate aktivnih obavještenja.</Text>
              <Text style={styles.emptySubText}>Zapratite mečeve i takmičenja.</Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {subscribedCompetitions.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>Takmičenja</Text>
                  {subscribedCompetitions.map((competition) => (
                    <View key={competition.id} style={styles.matchCard}>
                      <View style={styles.matchHeader}>
                        <Text style={styles.sportName}>Naučno takmičenje</Text>
                        <Ionicons name="school" size={16} color="#10345bff" />
                      </View>
                      <Text style={styles.competitionTitle}>{competition.naziv_predmeta}</Text>
                      {competition.top_rezultati && competition.top_rezultati.length > 0 ? (
                        <Text style={styles.competitionStatus}>Rezultati objavljeni</Text>
                      ) : (
                        <Text style={styles.competitionStatusPending}>Čeka se objava rezultata</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {subscribedMatches.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>Sportski mečevi</Text>
                  {subscribedMatches.map((match) => {
                    const statusBadge = getStatusBadge(match.Status);
                    return (
                      <View key={match.IdMatch} style={styles.matchCard}>
                        <View style={styles.matchHeader}>
                          <Text style={styles.sportName}>{match.SportName}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
                            <Ionicons name={statusBadge.icon} size={10} color="#fff" />
                            <Text style={styles.statusText}>{statusBadge.text}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.teamsContainer}>
                          <View style={styles.teamRow}>
                            <Text style={styles.teamName}>{match.Team1Name}</Text>
                            <Text style={styles.score}>{match.ResultTeam1 || 0}</Text>
                          </View>
                          <View style={styles.teamRow}>
                            <Text style={styles.teamName}>{match.Team2Name}</Text>
                            <Text style={styles.score}>{match.ResultTeam2 || 0}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    height: height * 0.8,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 38,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginTop: 20,
  },
  emptySubText: {
    fontSize: 14,
    color: "#999",
    marginTop: 10,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  matchCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sportName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 4,
  },
  teamsContainer: {
    gap: 8,
  },
  teamRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  score: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#10345bff",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    marginTop: 5,
  },
  competitionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 5,
  },
  competitionStatus: {
    fontSize: 13,
    color: "#4CAF50",
    marginTop: 5,
    fontWeight: "500",
  },
  competitionStatusPending: {
    fontSize: 13,
    color: "#ff9800",
    marginTop: 5,
    fontWeight: "500",
  },
});

export default NotificationsModal;
