// screens/SportsScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Alert } from "react-native";
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

const SportsScreen = () => {
  const [sportTypes, setSportTypes] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [allMatches, setAllMatches] = useState([]); // Čuvamo sve mečeve
  const [matches, setMatches] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [subscribedMatches, setSubscribedMatches] = useState(new Set());

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
    fetchSportTypes();
    fetchMatches();
  }, []);

  const fetchSubscriptions = async (token) => {
    try {
      const response = await apiClient.get(`/match-notifications/my-subscriptions/${token}`);
      setSubscribedMatches(new Set(response.data));
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
        // Alert.alert('Greška', 'Dozvola za notifikacije nije odobrena!');
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
          showAlert("Greška", "Neuspješno dobavljanje push tokena: " + e.message);
          // Fallback attempt
          try {
            token = (await Notifications.getExpoPushTokenAsync()).data;
          } catch (e2) {
             console.error("Fallback error:", e2);
          }
      }
      console.log("Expo Push Token:", token);
    } else {
      showAlert('Info', 'Morate koristiti fizički uređaj za Push notifikacije');
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  const toggleNotification = async (matchId) => {
    if (!expoPushToken) {
      showAlert("Greška", "Nije moguće aktivirati notifikacije (nedostaje token).");
      return;
    }

    const isSubscribed = subscribedMatches.has(matchId);
    const url = isSubscribed ? "/match-notifications/unsubscribe" : "/match-notifications/subscribe";
    
    // Optimistic update
    const newSubscriptions = new Set(subscribedMatches);
    if (isSubscribed) {
      newSubscriptions.delete(matchId);
    } else {
      newSubscriptions.add(matchId);
    }
    setSubscribedMatches(newSubscriptions);

    try {
      await apiClient.post(url, {
        IdMatch: matchId,
        ExpoPushToken: expoPushToken
      });
    } catch (error) {
      console.error("Error toggling notification:", error);
      // Revert on error
      setSubscribedMatches(prev => {
        const reverted = new Set(prev);
        if (isSubscribed) reverted.add(matchId);
        else reverted.delete(matchId);
        return reverted;
      });
      showAlert("Greška", "Došlo je do greške prilikom promjene statusa notifikacija.");
    }
  };

  useEffect(() => {
    if (selectedSport && allMatches.length > 0) {
      filterMatchesBySport();
    }
  }, [selectedSport, allMatches]);

  const fetchSportTypes = async () => {
    try {
      const response = await apiClient.get("/public-sports/list");
      // Transformišemo backend format [{ IdSport, Name }] u array stringova
      const sportNames = response.data.map(sport => sport.Name);
      setSportTypes(sportNames);
      if (sportNames.length > 0) {
        setSelectedSport(sportNames[0]); // Default: prvi sport
      }
    } catch (error) {
      console.error("Error fetching sport types:", error);
    }
  };

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/public-sports/matches");
      // Čuvamo sve mečeve za kasniju filtraciju
      setAllMatches(response.data);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterMatchesBySport = () => {
    // Filtriramo mečeve po odabranom sportu
    const filteredMatches = allMatches.filter(
      match => match.SportName === selectedSport
    );

    // Transformišemo i grupišemo po datumu
    const groupedByDate = {};
    filteredMatches.forEach(match => {
      // Izdvajamo datum iz StartDate
      const date = match.StartDate.split('T')[0];
      
      // Izdvajamo vrijeme iz StartDate ili Duration
      const startDateTime = new Date(match.StartDate);
      let vrijeme;
      
      if (match.Duration && typeof match.Duration === 'string') {
        // Duration je već u formatu string (npr. "02:00:00")
        vrijeme = match.Duration;
      } else {
        // Izvlačimo vrijeme iz StartDate
        vrijeme = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}:00`;
      }

      // Transformišemo u format koji UI očekuje
      const transformedMatch = {
        id: match.IdMatch,
        tim1: match.Team1Name,
        tim2: match.Team2Name,
        rezultat_tim1: match.ResultTeam1 || 0,
        rezultat_tim2: match.ResultTeam2 || 0,
        status: match.Status,
        vrijeme: vrijeme
      };

      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(transformedMatch);
    });

    setMatches(groupedByDate);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSportTypes(), fetchMatches()]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getSportIcon = (sport) => {
    const icons = {
      Fudbal: "football",
      Košarka: "basketball",
      Tenis: "tennisball",
      Odbojka: "american-football",
      Rukomet: "football",
    };
    return icons[sport] || "trophy";
  };

  const getDateLabel = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = date.toDateString();
    const todayOnly = today.toDateString();
    const yesterdayOnly = yesterday.toDateString();
    const tomorrowOnly = tomorrow.toDateString();

    if (dateOnly === yesterdayOnly) return "Juče";
    if (dateOnly === todayOnly) return "Danas";
    if (dateOnly === tomorrowOnly) return "Sutra";

    return date.toLocaleDateString("sr-Latn-BA", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const getStatusBadge = (status) => {
    if (status === "u_toku") {
      return { text: "UŽIVO", color: "#FF3B30", icon: "radio-button-on" };
    } else if (status === "zavrsena") {
      return { text: "ZAVRŠENO", color: "#999", icon: "checkmark-circle" };
    }
    return null;
  };

  const formatTime = (timeString) => {
    // timeString je u formatu "HH:MM:SS"
    if (!timeString || typeof timeString !== 'string') {
      return '00:00';
    }
    return timeString.substring(0, 5); // Vraća "HH:MM"
  };

  const renderMatch = (match) => {
    const statusBadge = getStatusBadge(match.status);

    return (
      <View key={match.id} style={styles.matchRow}>
        {/* Vrijeme */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(match.vrijeme)}</Text>
          {statusBadge && (
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
              <Ionicons name={statusBadge.icon} size={10} color="#fff" />
              <Text style={styles.statusText}>{statusBadge.text}</Text>
            </View>
          )}
        </View>

        {/* Timovi i rezultat */}
        <View style={styles.matchInfo}>
          {/* Tim 1 */}
          <View style={styles.teamRow}>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.tim1}
            </Text>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreText}>{match.rezultat_tim1}</Text>
            </View>
          </View>

          {/* Tim 2 */}
          <View style={styles.teamRow}>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.tim2}
            </Text>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreText}>{match.rezultat_tim2}</Text>
            </View>
          </View>
        </View>

        {/* Notification Bell */}
        {Platform.OS !== "web" && (
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => toggleNotification(match.id)}
          >
            <Ionicons 
              name={subscribedMatches.has(match.id) ? "notifications" : "notifications-outline"} 
              size={24} 
              color={subscribedMatches.has(match.id) ? "#10345bff" : "#999"} 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDateCard = (dateString, matchesForDate) => {
    return (
      <View key={dateString} style={styles.dateCard}>
        {/* Date Header */}
        <View style={styles.dateHeader}>
          <Ionicons name="calendar" size={20} color="#10345bff" />
          <Text style={styles.dateLabel}>{getDateLabel(dateString)}</Text>
          <Text style={styles.dateSubLabel}>
            {new Date(dateString).toLocaleDateString("sr-Latn-BA", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Matches */}
        <View style={styles.matchesContainer}>{matchesForDate.map((match) => renderMatch(match))}</View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sport Type Selector */}
      <View style={styles.sportsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {sportTypes.map((sport) => (
            <TouchableOpacity
              key={sport}
              style={[styles.sportButton, selectedSport === sport && styles.sportButtonActive]}
              onPress={() => setSelectedSport(sport)}
            >
              <Ionicons name={getSportIcon(sport)} size={24} color={selectedSport === sport ? "#fff" : "#10345bff"} />
              <Text style={[styles.sportButtonText, selectedSport === sport && styles.sportButtonTextActive]}>
                {sport}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Matches List */}
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
        ) : Object.keys(matches).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Nema utakmica za odabrani sport</Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {Object.keys(matches)
              .sort()
              .map((date) => renderDateCard(date, matches[date]))}
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
    paddingBottom: 55,
  },
  sportsContainer: {
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
  },
  sportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 25,
    backgroundColor: "#f8f8f8",
    borderWidth: 2,
    borderColor: "#10345bff",
  },
  sportButtonActive: {
    backgroundColor: "#10345bff",
    borderColor: "#10345bff",
  },
  sportButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#10345bff",
    marginLeft: 8,
  },
  sportButtonTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  cardsContainer: {
    padding: 15,
  },
  dateCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
    flex: 1,
  },
  dateSubLabel: {
    fontSize: 13,
    color: "#666",
  },
  matchesContainer: {
    padding: 10,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  timeContainer: {
    width: 80,
    alignItems: "center",
  },
  timeText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 3,
  },
  matchInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 5,
  },
  teamName: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
    flex: 1,
    marginRight: 10,
  },
  scoreBox: {
    backgroundColor: "#10345bff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    alignItems: "center",
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  notificationButton: {
    padding: 10,
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

export default SportsScreen;
