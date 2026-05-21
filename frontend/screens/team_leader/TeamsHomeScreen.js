import React, { useEffect, useState, useCallback } from "react";
import { Platform, View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const TeamsHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facultyMap, setFacultyMap] = useState({});

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/teams/${user.IdUser}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setTeams(res.data);
      
      const map = {};
      res.data.forEach((t) => {
        map[t.IdTeam] = t.FacultyId;
      });
      setFacultyMap(map);
    } catch (err) {
      console.error("Error loading teams:", err);
      Alert.alert("Greška", "Neuspješno učitavanje timova.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTeams();
    }, [])
  );

  const deleteTeam = async (teamId) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Da li ste sigurni da želite obrisati tim?");
      if (!confirmed) return;
      try {
        await apiClient.delete(`/teams/${teamId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        // Na webu koristimo alert ili console.log jer Alert.alert nije standardan
        alert("Tim je obrisan."); 
        loadTeams();
      } catch (err) {
        alert(err.response?.data?.message || "Neuspješno brisanje tima.");
      }
    } else {
      Alert.alert("Potvrda", "Da li ste sigurni da želite obrisati tim?", [
        { text: "Otkaži", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/teams/${teamId}`, {
                headers: { Authorization: `Bearer ${user.token}` },
              });
              Alert.alert("Uspjeh", "Tim je obrisan.");
              loadTeams();
            } catch (err) {
              Alert.alert("Greška", err.response?.data?.message || "Neuspješno brisanje tima.");
            }
          },
        },
      ]);
    }
  };

  const renderItem = ({ item }) => {
    // Određujemo naziv takmičenja (bilo sport ili nauka)
    // Backend sada vraća "SportName" ili "ScienceName" (null ako ne postoji)
    const competitionName = item.SportName || item.ScienceName || "Nepoznato takmičenje";
    const competitionType = item.SportName ? "Sport" : item.ScienceName ? "Nauka" : "";

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.TeamName}</Text>
        <Text style={styles.subtitle}>{item.Category} • {item.FacultyName}</Text>
        
        {/* NOVI DIO: Prikaz takmičenja */}
        <View style={styles.competitionContainer}>
            <Ionicons 
                name={item.SportName ? "football-outline" : "flask-outline"} 
                size={16} 
                color="#10345bff" 
                style={{ marginRight: 5 }}
            />
            <Text style={styles.competitionText}>
               {competitionName}
            </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => navigation.navigate("TeamForm", { team: item })}>
            <Ionicons name="create-outline" size={24} color="#10345bff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteTeam(item.IdTeam)}>
            <Ionicons name="trash-outline" size={24} color="red" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() =>
              navigation.navigate("TeamMembers", {
                team: item,
                facultyId: facultyMap[item.IdTeam],
              })
            }
          >
            <Ionicons name="people-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator size="large" color="#10345bff" /> : (
        <FlatList
          data={teams}
          keyExtractor={(t) => String(t.IdTeam)}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Nema timova.</Text>}
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("TeamForm")}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: { backgroundColor: "#fff", margin: 10, padding: 15, borderRadius: 10, elevation: 2 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 5 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 8 },
  
  // Novi stilovi za prikaz takmičenja
  competitionContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2f6",
    padding: 6,
    borderRadius: 5,
    alignSelf: "flex-start",
    marginBottom: 5
  },
  competitionText: {
    fontSize: 14,
    color: "#10345bff",
    fontWeight: "500",
  },

  actions: { flexDirection: "row", justifyContent: "space-around", marginTop: 10, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 10 },
  empty: { textAlign: "center", marginTop: 20, color: "#666" },
  fab: {
    backgroundColor: "#10345bff",
    alignSelf: "center",
    borderRadius: 30,
    padding: 15,
    marginVertical: 20,
    marginBottom: 100
  },
});

export default TeamsHomeScreen;