// screens/CompetitionsScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Linking, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import apiClient from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


const CompetitionsScreen = ({ navigation }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dates, setDates] = useState([]);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [subscribedCompetitions, setSubscribedCompetitions] = useState(new Set());


  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web") {
      registerForPushNotificationsAsync().then(token => {
        setExpoPushToken(token);
        if (token) {
          fetchSubscriptions(token);
        }
      });
    }
    // Generiši 5 datuma: Prekjuče, Juče, Danas, Sutra, Prekosutra
    const today = new Date();
    const datesList = [
      { label: "Prekjuče", date: getDateOffset(today, -2), offset: -2 },
      { label: "Juče", date: getDateOffset(today, -1), offset: -1 },
      { label: "Danas", date: getDateOffset(today, 0), offset: 0 },
      { label: "Sutra", date: getDateOffset(today, 1), offset: 1 },
      { label: "Prekosutra", date: getDateOffset(today, 2), offset: 2 },
    ];
    setDates(datesList);
    setSelectedDate(datesList[2]); // Default: Danas
  }, []);


  useEffect(() => {
    if (selectedDate) {
      fetchCompetitions();
    }
  }, [selectedDate]);

  const getDateOffset = (date, offset) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + offset);
    return newDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
  };

  const fetchSubscriptions = async (token) => {
    try {
      const response = await apiClient.get(`/competition-notifications/my-subscriptions/${token}`);
      setSubscribedCompetitions(new Set(response.data));
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    }
  };

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      try {
          const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
          if (!projectId) {
             console.log('Project ID not found, trying default getExpoPushTokenAsync');
             token = (await Notifications.getExpoPushTokenAsync()).data;
          } else {
             console.log('Project ID found:', projectId);
             token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          }
      } catch (e) {
          console.error("Error getting push token:", e);
          try {
            token = (await Notifications.getExpoPushTokenAsync()).data;
          } catch (e2) {
             console.error("Fallback error:", e2);
          }
      }
      console.log("Expo Push Token:", token);
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  const toggleNotification = async (competitionId) => {
    if (!expoPushToken) {
      showAlert("Greška", "Nije moguće aktivirati notifikacije (nedostaje token).");
      return;
    }

    const isSubscribed = subscribedCompetitions.has(competitionId);
    const url = isSubscribed ? "/competition-notifications/unsubscribe" : "/competition-notifications/subscribe";
    
    // Optimistic update
    const newSubscriptions = new Set(subscribedCompetitions);
    if (isSubscribed) {
      newSubscriptions.delete(competitionId);
    } else {
      newSubscriptions.add(competitionId);
    }
    setSubscribedCompetitions(newSubscriptions);

    try {
      await apiClient.post(url, {
        IdScienceCompetition: competitionId,
        ExpoPushToken: expoPushToken
      });
      
      // Success - no alert needed, bell color change is enough
    } catch (error) {
      console.error("Error toggling notification:", error);
      // Revert on error
      setSubscribedCompetitions(prev => {
        const reverted = new Set(prev);
        if (isSubscribed) reverted.add(competitionId);
        else reverted.delete(competitionId);
        return reverted;
      });
      showAlert("Greška", "Došlo je do greške prilikom promjene statusa notifikacija.");
    }
  };

  const fetchCompetitions = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/public-competitions/by-date", {
        params: { date: selectedDate.date },
      });
      setCompetitions(response.data);
    } catch (error) {
      console.error("Error fetching competitions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchCompetitions();
    } catch (error) {
      console.error("Error refreshing competitions:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getMedalIcon = (rang) => {
    if (rang === 1) return { name: "trophy", color: "#FFD700" };
    if (rang === 2) return { name: "trophy", color: "#C0C0C0" };
    if (rang === 3) return { name: "trophy", color: "#CD7F32" };
    return { name: "star-outline", color: "#999" };
  };

  const downloadSolution = async (link) => {
    if (!link) {
      showAlert("Greška", "Link za rješenje nije dostupan.");
      return;
    }

    try {
      const supported = await Linking.canOpenURL(link);
      if (supported) {
        await Linking.openURL(link);
      } else {
        showAlert("Greška", "Ne može se otvoriti link: " + link);
      }
    } catch (error) {
      console.error("Error opening link:", error);
      showAlert("Greška", "Došlo je do greške prilikom preuzimanja fajla.");
    }
  };

  const renderCompetitionCard = ({ item }) => {
    const hasResults = item.top_rezultati && item.top_rezultati.length > 0;
    const isSubscribed = subscribedCompetitions.has(item.id);

    return (
      <View style={styles.competitionCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.subjectName}>{item.naziv_predmeta}</Text>
        </View>

        {item.opis && <Text style={styles.description}>{item.opis}</Text>}

        <View style={styles.resultsContainer}>
          {hasResults ? (
            item.top_rezultati.map((rezultat) => {
              return (
                <View key={rezultat.id} style={styles.resultRow}>
                  <View style={styles.rankContainer}>
                    <Text style={styles.rankText}>{rezultat.rang}.</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {rezultat.ime_studenta} {rezultat.prezime_studenta}
                    </Text>
                  </View>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{rezultat.broj_bodova}</Text>
                    <Text style={styles.scoreLabel}>bodova</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.noResults}>Nema dostupnih rezultata</Text>
          )}
        </View>

        {/* Akcioni dugmići ili notifikaciona zvjezdica */}
        {hasResults ? (
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => downloadSolution(item.link_rjesenja)}
            >
              <Text style={styles.actionButtonText}>Rješenja</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => navigation.navigate('AllResults', {
                competitionId: item.id,
                competitionName: item.naziv_predmeta
              })}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Svi rezultati</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Platform.OS !== "web" ? (
            <View style={styles.notificationContainer}>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => toggleNotification(item.id)}
              >
                <Ionicons 
                  name={isSubscribed ? "notifications" : "notifications-outline"} 
                  size={32} 
                  color={isSubscribed ? "#10345bff" : "#999"} 
                />
                <Text style={styles.notificationText}>
                  {isSubscribed ? "Pratite ovo takmičenje" : "Pratite za obavještenja"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        )}
      </View>
    );
  };


  return (
    <View style={styles.container}>
      {/* Date Selector */}
      <View style={styles.dateContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dates.map((dateItem) => (
            <TouchableOpacity
              key={dateItem.offset}
              style={[styles.dateButton, selectedDate?.offset === dateItem.offset && styles.dateButtonActive]}
              onPress={() => setSelectedDate(dateItem)}
            >
              <Text
                style={[styles.dateButtonText, selectedDate?.offset === dateItem.offset && styles.dateButtonTextActive]}
              >
                {dateItem.label}
              </Text>
              <Text
                style={[
                  styles.dateButtonSubtext,
                  selectedDate?.offset === dateItem.offset && styles.dateButtonSubtextActive,
                ]}
              >
                {new Date(dateItem.date).toLocaleDateString("sr-Latn-BA", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Competitions List */}
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
        ) : competitions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Nema takmičenja za ovaj datum</Text>
          </View>
        ) : (
          <FlatList
            data={competitions}
            renderItem={renderCompetitionCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    marginBottom: 55
  },
  dateContainer: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignContent: "center", 
    alignItems: "center"
  },
  dateButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 12,
    backgroundColor: "#f8f8f8",
    alignItems: "center",
    minWidth: 100,
    justifyContent: "center",
  },
  dateButtonActive: {
    backgroundColor: "#10345bff",
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  dateButtonTextActive: {
    color: "#fff",
  },
  dateButtonSubtext: {
    fontSize: 12,
    color: "#999",
  },
  dateButtonSubtextActive: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 15,
  },
  competitionCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  subjectName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    fontStyle: "italic",
  },
  resultsContainer: {
    marginBottom: 15,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  rankContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 60,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  studentInfo: {
    flex: 1,
    marginLeft: 10,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#999",
  },
  noResults: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    paddingVertical: 20,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginLeft: 80,
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7d7c7cff",
    marginHorizontal: 5,
  },
  actionButtonPrimary: {
    backgroundColor: "#fa8d10ff",
    borderColor: "#fa8d10ff",
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7d7c7cff",
    marginLeft: 8,
  },
  actionButtonTextPrimary: {
    color: "#fff",
  },
  notificationContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  notificationButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  notificationText: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
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

export default CompetitionsScreen;
