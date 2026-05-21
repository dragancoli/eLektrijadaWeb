import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const NONE = "__none__";

const ManageSportTeamPositionsScreen = () => {
  const { user } = useAuth();

  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState(NONE);

  const [teams, setTeams] = useState([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    if (selectedCompetition !== NONE) await loadTeams();
    setRefreshing(false);
  };

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition !== NONE) {
      loadTeams();
    } else {
      setTeams([]);
    }
  }, [selectedCompetition]);

  const loadCompetitions = async () => {
    setLoadingCompetitions(true);
    try {
      const res = await apiClient.get("/sports/competitions", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setCompetitions(res.data || []);
    } catch (error) {
      console.error("Greška pri učitavanju takmičenja:", error);
      showAlert("Greška", "Nije moguće učitati takmičenja.");
    } finally {
      setLoadingCompetitions(false);
    }
  };

  const selectedCompetitionObj = useMemo(() => {
    if (selectedCompetition === NONE) return null;
    return competitions.find((c) => String(c.IdSportCompetition) === String(selectedCompetition)) || null;
  }, [competitions, selectedCompetition]);

  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const res = await apiClient.get("/sports/teams", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const allTeams = res.data || [];

      let filtered = allTeams;

      // Ako backend doda IdSportCompetition u SELECT, koristi to:
      if (allTeams.length > 0 && allTeams[0].IdSportCompetition !== undefined) {
        filtered = allTeams.filter((t) => String(t.IdSportCompetition) === String(selectedCompetition));
      } else if (selectedCompetitionObj) {
        // Fallback: filtriraj po SportName + Year (isti princip kao kod mečeva)
        filtered = allTeams.filter(
          (t) =>
            t.SportName === selectedCompetitionObj.SportName && String(t.Year) === String(selectedCompetitionObj.Year)
        );
      }

      // Sortiraj po postojećoj poziciji, nepostavljene pozicije stavi na kraj
      filtered.sort((a, b) => {
        const posA = a.Position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.Position ?? Number.MAX_SAFE_INTEGER;
        return posA - posB;
      });

      // Ako neki tim nema poziciju, dodijeli privremeno prema redoslijedu
      const normalized = filtered.map((t, idx) => ({
        ...t,
        LocalPosition: idx + 1,
      }));

      setTeams(normalized);
    } catch (error) {
      console.error("Greška pri učitavanju timova:", error);
      showAlert("Greška", "Nije moguće učitati timove.");
    } finally {
      setLoadingTeams(false);
    }
  };

  // Broj timova => opcije za pozicije 1..N
  const positionOptions = useMemo(() => {
    const n = teams.length;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [teams.length]);

  // Promjena pozicije za pojedinačan tim
  const handlePositionChange = (teamId, newPosition) => {
    setTeams((prev) => {
      const current = [...prev];
      const teamIndex = current.findIndex((t) => t.IdTeam === teamId);
      if (teamIndex === -1) return prev;

      const team = current[teamIndex];

      // Izbaci tim iz niza
      current.splice(teamIndex, 1);
      // Ubaci ga na novi index (newPosition - 1)
      const targetIndex = Math.max(0, Math.min(current.length, newPosition - 1));
      current.splice(targetIndex, 0, team);

      // Normalizuj LocalPosition = index + 1 za sve
      return current.map((t, idx) => ({
        ...t,
        LocalPosition: idx + 1,
      }));
    });
  };

  const saveAllPositions = async () => {
    if (teams.length === 0) {
      showAlert("Greška", "Nema timova za čuvanje pozicija.");
      return;
    }

    setSaving(true);
    try {
      // Po želji možeš dodati potvrdu
      // Kreiraj niz promise-a za sve timove
      const promises = teams.map((team) =>
        apiClient.put(
          `/sports/teams/${team.IdTeam}`,
          { Position: team.LocalPosition },
          { headers: { Authorization: `Bearer ${user?.token}` } }
        )
      );

      await Promise.all(promises);

      showAlert("Uspjeh", "Sve pozicije su uspješno sačuvane.");
      // Ponovo učitaj timove (da osvježiš stanje iz baze, ako želiš)
      loadTeams();
    } catch (error) {
      console.error("Greška pri čuvanju pozicija:", error);
      const msg = error.response?.data?.message || "Došlo je do greške prilikom čuvanja pozicija.";
      showAlert("Greška", msg);
    } finally {
      setSaving(false);
    }
  };

  const renderTeamCard = (team) => {
    const currentPos = team.LocalPosition ?? team.Position ?? 0;

    return (
      <View key={team.IdTeam} style={styles.teamCard}>
        <View style={styles.teamHeader}>
          <View style={styles.teamTitleRow}>
            <Ionicons name="people-circle-outline" size={26} color="#10345bff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{team.TeamName}</Text>
              <Text style={styles.teamMeta}>
                {team.FacultyName} • {team.Category}
              </Text>
            </View>
          </View>

          <View style={styles.positionBadge}>
            <Text style={styles.positionBadgeText}>{currentPos}.</Text>
          </View>
        </View>

        <View style={styles.positionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Pozicija</Text>
            <View style={styles.positionPickerWrapper}>
              <Picker
                selectedValue={currentPos}
                onValueChange={(val) => handlePositionChange(team.IdTeam, Number(val))}
                style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
                itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
              >
                {positionOptions.map((pos) => (
                  <Picker.Item key={pos} label={`${pos}. mjesto`} value={pos} />
                ))}
              </Picker>
            </View>
            <Text style={styles.positionHint}>
              Promjenom pozicije ovog tima automatski se mijenja redoslijed ostalih.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header opis */}
      <View style={styles.headerCard}>
        <Ionicons name="podium-outline" size={28} color="#10345bff" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Unos pozicija timova</Text>
          <Text style={styles.headerSubtitle}>
            Odaberite takmičenje i podesite konačan poredak timova. Možete mijenjati poziciju pojedinačno, a zatim
            jednim klikom sačuvati sve promjene.
          </Text>
        </View>
      </View>

      {/* Filter takmičenja */}
      <View style={styles.filterContainer}>
        <Text style={styles.label}>Takmičenje</Text>
        <View style={styles.pickerWrapper}>
          {loadingCompetitions ? (
            <ActivityIndicator size="small" color="#10345bff" />
          ) : (
            <Picker
              selectedValue={selectedCompetition}
              onValueChange={(val) => setSelectedCompetition(String(val))}
              style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
              itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
            >
              <Picker.Item
                label="— Odaberite takmičenje —"
                value={NONE}
                color={Platform.OS === "ios" ? "#999" : "#666"}
              />
              {competitions.map((comp) => (
                <Picker.Item
                  key={comp.IdSportCompetition}
                  label={`${comp.SportName} ${comp.Year}`}
                  value={String(comp.IdSportCompetition)}
                />
              ))}
            </Picker>
          )}
        </View>
      </View>

      {/* Lista timova */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10345bff"]}
            tintColor="#10345bff"
          />
        }
      >
        {selectedCompetition === NONE ? (
          <View style={styles.emptyState}>
            <Ionicons name="information-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Odaberite takmičenje kako biste vidjeli i uredili poredak timova.</Text>
          </View>
        ) : loadingTeams ? (
          <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 40 }} />
        ) : teams.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nema timova za odabrano takmičenje.</Text>
          </View>
        ) : (
          teams.map(renderTeamCard)
        )}
      </ScrollView>

      {/* Globalno dugme: Sačuvaj sve pozicije */}
      {selectedCompetition !== NONE && teams.length > 0 && (
        <View style={styles.saveAllContainer}>
          <TouchableOpacity
            style={styles.saveAllButton}
            onPress={saveAllPositions}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-done-outline" size={22} color="#fff" />
                <Text style={styles.saveAllText}>Sačuvaj sve pozicije</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },

  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 12,
    borderRadius: 16,
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10345bff",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
  },

  filterContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#e0e0e0",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },

  pickerWrapper: {
    borderColor: "#e0e0e0",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    overflow: "hidden",
    justifyContent: "center",
  },
  pickerIOS: {
    height: 100,
    width: "100%",
  },
  pickerItemIOS: {
    height: 100,
  },
  pickerAndroid: {
    height: 50,
    width: "100%",
  },

  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  teamCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#e0e0e0",
  },
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  teamTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  teamMeta: {
    fontSize: 13,
    color: "#777",
  },
  positionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#EAF3FF",
  },
  positionBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10345bff",
  },

  positionRow: {
    marginTop: 4,
  },
  positionPickerWrapper: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    overflow: "hidden",
  },
  positionHint: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginTop: 12,
  },

  saveAllContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: "center",
    paddingBottom: 70,
  },
  saveAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10345bff",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  saveAllText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default ManageSportTeamPositionsScreen;
