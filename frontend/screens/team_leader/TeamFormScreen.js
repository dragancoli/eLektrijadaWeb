import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const TeamFormScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const team = route.params?.team;

  // Određujemo početni tab na osnovu toga da li uređujemo postojeći sportski ili naučni tim
  const [activeTab, setActiveTab] = useState(
    team?.IdSportCompetition ? "SPORT" : "NAUKA"
  );
  
  const [name, setName] = useState(team?.TeamName || "");
  const [scienceCompetitions, setScienceCompetitions] = useState([]);
  const [sportCompetitions, setSportCompetitions] = useState([]);
  
  const [selectedScienceCompetition, setSelectedScienceCompetition] = useState(team?.IdScienceCompetition || null);
  const [selectedSportCompetition, setSelectedSportCompetition] = useState(team?.IdSportCompetition || null);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    // Provjera da li su podaci učitani kako treba
    if (!user || !user.IdFaculty) {
      showAlert(
        "Pažnja",
        "Nedostaju podaci o fakultetu. Molimo vas da se odjavite i ponovo prijavite."
      );
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Konfiguracija sa tokenom jer su rute zaštićene
        const config = {
          headers: { Authorization: `Bearer ${user.token}` },
        };

        // Paralelno učitavanje obe liste takmičenja
        const [sciRes, sportRes] = await Promise.all([
          apiClient.get("/sciences/competitions", config),
          apiClient.get("/sports/competitions/teamLeader", config)
        ]);

        setScienceCompetitions(sciRes.data);
        setSportCompetitions(sportRes.data);
      } catch (err) {
        console.error("Greška pri učitavanju takmičenja:", err.response?.data || err.message);
        if (err.response?.status === 401) {
          Alert.alert("Greška", "Vaša sesija je istekla. Prijavite se ponovo.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const saveTeam = async () => {
    if (!name.trim()) {
      showAlert("Greška", "Unesite naziv tima.");
      return;
    }

    // 2. Validacija Faculty ID-a
    if (!user || !user.IdFaculty) {
      showAlert("Greška", "Nije detektovan ID fakulteta. Pokušajte se ponovo ulogovati.");
      return;
    }

    setSubmitting(true);

    try {
      const isScience = activeTab === "NAUKA";
      
      const payload = {
        Name: name,
        Category: isScience ? "Nauka" : "Sport",
        Position: null,
        IdLeader: user.IdUser,
        IdFaculty: Number(user.IdFaculty),
        // Ako smo na nauka tabu, šaljemo naučni ID, sportski ide na null
        IdScienceCompetition: isScience ? (selectedScienceCompetition ? Number(selectedScienceCompetition) : null) : null,
        IdSportCompetition: !isScience ? (selectedSportCompetition ? Number(selectedSportCompetition) : null) : null,
      };

      if (team) {
        await apiClient.put(`/teams/${team.IdTeam}`, payload, {
          headers: { Authorization: `Bearer ${user.token}` }, // Token iz user objekta
        });
        showAlert("Uspjeh", "Tim je ažuriran.");
      } else {
        await apiClient.post("/teams", payload, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        showAlert("Uspjeh", "Tim je kreiran.");
      }
      
      navigation.goBack();
    } catch (err) {
      console.error("Greška:", err.response?.data);
      showAlert("Greška", err.response?.data?.message || "Neuspješno snimanje tima.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }} // Dodaje unutrašnji padding da se sadržaj ne odsiječe
    >
      <Text style={styles.headerTitle}>
        {team ? "Uredi tim" : "Kreiraj novi tim"}
      </Text>

      {/* TABOVI ZA IZBOR KATEGORIJE */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === "NAUKA" && styles.activeTab]} 
          onPress={() => setActiveTab("NAUKA")}
        >
          <Text style={[styles.tabText, activeTab === "NAUKA" && styles.activeTabText]}>Nauka</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === "SPORT" && styles.activeTab]} 
          onPress={() => setActiveTab("SPORT")}
        >
          <Text style={[styles.tabText, activeTab === "SPORT" && styles.activeTabText]}>Sport</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Naziv tima</Text>
      <TextInput
        style={styles.input}
        placeholder="Unesite naziv tima"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>
        {activeTab === "NAUKA" ? "Naučno takmičenje" : "Sportsko takmičenje"}
      </Text>

      <View style={styles.pickerWrapper}>
        {loading ? (
          <ActivityIndicator size="small" color="#10345bff" style={{ padding: 15 }} />
        ) : (
          <Picker
            selectedValue={activeTab === "NAUKA" ? selectedScienceCompetition : selectedSportCompetition}
            onValueChange={(itemValue) => 
              activeTab === "NAUKA" ? setSelectedScienceCompetition(itemValue) : setSelectedSportCompetition(itemValue)
            }
            style={styles.picker}
            dropdownIconColor="#10345bff"
            // itemStyle je ključan za visinu fonta unutar iOS točka
            itemStyle={{ fontSize: 16, height: 130 }}
          >
            <Picker.Item label="-- Izaberite takmičenje --" value={null} />
            {activeTab === "NAUKA" 
              ? scienceCompetitions.map((c) => (
                  <Picker.Item 
                    key={c.IdScienceCompetition} 
                    label={`${c.Science_Name}${c.Year ? " • " + c.Year : ""}`} 
                    value={c.IdScienceCompetition} 
                  />
                ))
              : sportCompetitions.map((s) => (
                  <Picker.Item 
                    key={s.IdSportCompetition} 
                    label={`${s.SportName}${s.Year ? " • " + s.Year : ""}`} 
                    value={s.IdSportCompetition} 
                  />
                ))
            }
          </Picker>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.button, submitting && styles.buttonDisabled]} 
        onPress={saveTeam}
        disabled={submitting}
      >
        {submitting ? (
           <ActivityIndicator color="#fff" />
        ) : (
           <Text style={styles.buttonText}>
             {team ? "Sačuvaj izmjene" : "Kreiraj tim"}
           </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color:"#10345bff", marginBottom: 20, textAlign: "center" },
  
  // Stilovi za tabove
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f2f5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 25,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: "#10345bff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#666",
  },
  activeTabText: {
    color: "#fff",
  },

  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#fafafa",
  },
  
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    marginBottom: 35,
    // Na iOS-u skidamo overflow hidden jer može odsjeći točak
    // Na iOS-u visina treba biti automatska ili veća (cca 200)
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
    height: Platform.OS === 'ios' ? 100 : 55, 
    justifyContent: 'center',
  },
  
  picker: {
    width: "100%",
    // Na iOS-u standardni Picker (wheel) zahtijeva visinu (obično 216px default)
    // Na Androidu je to dropdown linija (55px je ok)
    height: Platform.OS === 'ios' ? 100 : 55,
  },

  button: {
    backgroundColor: "#10345bff",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: "#889cb4",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
});

export default TeamFormScreen;