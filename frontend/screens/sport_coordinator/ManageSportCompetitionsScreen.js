// screens/ManageSportCompetitionsScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const ManageSportCompetitionsScreen = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sports"); // 'sports' ili 'competitions'
  const [loading, setLoading] = useState(false);

  // Sports state
  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(false);

  // Competitions state
  const [competitions, setCompetitions] = useState([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' ili 'edit'
  const [modalType, setModalType] = useState("sport"); // 'sport' ili 'competition'
  const [selectedItem, setSelectedItem] = useState(null);

  // Form state
  const [sportName, setSportName] = useState("");
  const [compYear, setCompYear] = useState("");
  const [compSportId, setCompSportId] = useState("");

  useEffect(() => {
    loadSports();
    loadCompetitions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSports(), loadCompetitions()]);
    setRefreshing(false);
  };

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // === SPORTS CRUD ===
  const loadSports = async () => {
    setLoadingSports(true);
    try {
      const res = await apiClient.get("/sports", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setSports(res.data || []);
    } catch (error) {
      console.error("Greška pri učitavanju sportova:", error);
      showAlert("Greška", "Nije moguće učitati sportove.");
    } finally {
      setLoadingSports(false);
    }
  };

  const handleAddSport = () => {
    setModalMode("add");
    setModalType("sport");
    setSportName("");
    setSelectedItem(null);
    setModalVisible(true);
  };

  const handleEditSport = (sport) => {
    setModalMode("edit");
    setModalType("sport");
    setSportName(sport.Name);
    setSelectedItem(sport);
    setModalVisible(true);
  };

  const handleDeleteSport = (sport) => {
    const confirmAction = async () => {
      try {
        await apiClient.delete(`/sports/${sport.IdSport}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        showAlert("Uspjeh", "Sport je uspješno obrisan.");
        loadSports();
      } catch (error) {
        console.error("Greška pri brisanju sporta:", error);
        showAlert("Greška", error.response?.data?.message || "Nije moguće obrisati sport.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Da li ste sigurni da želite obrisati sport "${sport.Name}"?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        "Potvrda",
        `Da li ste sigurni da želite obrisati sport "${sport.Name}"?`,
        [
          { text: "Otkaži", style: "cancel" },
          {
            text: "Obriši",
            style: "destructive",
            onPress: confirmAction,
          },
        ]
      );
    }
  };

  const saveSport = async () => {
    if (!sportName.trim()) {
      showAlert("Greška", "Naziv sporta je obavezan.");
      return;
    }

    setLoading(true);
    try {
      if (modalMode === "add") {
        await apiClient.post("/sports", { Name: sportName }, { headers: { Authorization: `Bearer ${user?.token}` } });
        showAlert("Uspjeh", "Sport je uspješno dodat.");
      } else {
        await apiClient.put(
          `/sports/${selectedItem.IdSport}`,
          { Name: sportName },
          { headers: { Authorization: `Bearer ${user?.token}` } }
        );
        showAlert("Uspjeh", "Sport je uspješno ažuriran.");
      }
      setModalVisible(false);
      loadSports();
    } catch (error) {
      console.error("Greška pri čuvanju sporta:", error);
      showAlert("Greška", error.response?.data?.message || "Nije moguće sačuvati sport.");
    } finally {
      setLoading(false);
    }
  };

  // === COMPETITIONS CRUD ===
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

  const handleAddCompetition = () => {
    setModalMode("add");
    setModalType("competition");
    setCompYear("");
    setCompSportId("");
    setSelectedItem(null);
    setModalVisible(true);
  };

  const handleEditCompetition = (comp) => {
    setModalMode("edit");
    setModalType("competition");
    setCompYear(String(comp.Year));
    setCompSportId(String(comp.IdSport));
    setSelectedItem(comp);
    setModalVisible(true);
  };

  const handleDeleteCompetition = (comp) => {
    const confirmAction = async () => {
      try {
        await apiClient.delete(`/sports/competitions/${comp.IdSportCompetition}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        showAlert("Uspjeh", "Takmičenje je uspješno obrisano.");
        loadCompetitions();
      } catch (error) {
        console.error("Greška pri brisanju takmičenja:", error);
        showAlert("Greška", error.response?.data?.message || "Nije moguće obrisati takmičenje.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Da li ste sigurni da želite obrisati takmičenje "${comp.SportName} ${comp.Year}"?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        "Potvrda",
        `Da li ste sigurni da želite obrisati takmičenje "${comp.SportName} ${comp.Year}"?`,
        [
          { text: "Otkaži", style: "cancel" },
          {
            text: "Obriši",
            style: "destructive",
            onPress: confirmAction,
          },
        ]
      );
    }
  };

  const saveCompetition = async () => {
    if (!compSportId || !compYear) {
      showAlert("Greška", "Sport i godina su obavezni.");
      return;
    }

    setLoading(true);
    try {
      if (modalMode === "add") {
        await apiClient.post(
          "/sports/competitions",
          { IdSport: Number(compSportId), Year: Number(compYear) },
          { headers: { Authorization: `Bearer ${user?.token}` } }
        );
        showAlert("Uspjeh", "Takmičenje je uspješno dodato.");
      } else {
        await apiClient.put(
          `/sports/competitions/${selectedItem.IdSportCompetition}`,
          { IdSport: Number(compSportId), Year: Number(compYear) },
          { headers: { Authorization: `Bearer ${user?.token}` } }
        );
        showAlert("Uspjeh", "Takmičenje je uspješno ažurirano.");
      }
      setModalVisible(false);
      loadCompetitions();
    } catch (error) {
      console.error("Greška pri čuvanju takmičenja:", error);
      showAlert("Greška", error.response?.data?.message || "Nije moguće sačuvati takmičenje.");
    } finally {
      setLoading(false);
    }
  };

  // === RENDER ===
  const renderSportItem = (sport) => (
    <View key={sport.IdSport} style={styles.card}>
      <View style={styles.cardContent}>
        <Ionicons name="football-outline" size={28} color="#10345bff" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{sport.Name}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => handleEditSport(sport)} style={styles.actionButton}>
          <Ionicons name="create-outline" size={22} color="#10345bff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteSport(sport)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCompetitionItem = (comp) => (
    <View key={comp.IdSportCompetition} style={styles.card}>
      <View style={styles.cardContent}>
        <Ionicons name="trophy-outline" size={28} color="#10345bff" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{comp.SportName}</Text>
          <Text style={styles.cardSubtitle}>Godina: {comp.Year}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => handleEditCompetition(comp)} style={styles.actionButton}>
          <Ionicons name="create-outline" size={22} color="#10345bff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteCompetition(comp)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "sports" && styles.activeTab]}
          onPress={() => setActiveTab("sports")}
        >
          <Ionicons name="football" size={20} color={activeTab === "sports" ? "#fff" : "#666"} />
          <Text style={[styles.tabText, activeTab === "sports" && styles.activeTabText]}>Sportovi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "competitions" && styles.activeTab]}
          onPress={() => setActiveTab("competitions")}
        >
          <Ionicons name="trophy" size={20} color={activeTab === "competitions" ? "#fff" : "#666"} />
          <Text style={[styles.tabText, activeTab === "competitions" && styles.activeTabText]}>Takmičenja</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10345bff"]}
            tintColor="#10345bff"
          />
        }
      >
        {activeTab === "sports" ? (
          <>
            {loadingSports ? (
              <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 50 }} />
            ) : sports.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="football-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>Nema sportova</Text>
              </View>
            ) : (
              sports.map(renderSportItem)
            )}
          </>
        ) : (
          <>
            {loadingCompetitions ? (
              <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 50 }} />
            ) : competitions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>Nema takmičenja</Text>
              </View>
            ) : (
              competitions.map(renderCompetitionItem)
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={activeTab === "sports" ? handleAddSport : handleAddCompetition}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === "add" ? "Dodaj" : "Izmijeni"} {modalType === "sport" ? "sport" : "takmičenje"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {modalType === "sport" ? (
              <TextInput
                style={styles.input}
                placeholder="Naziv sporta"
                value={sportName}
                onChangeText={setSportName}
                autoCapitalize="words"
              />
            ) : (
              <>
                <View style={styles.pickerContainer}>
                  <Text style={styles.label}>Sport:</Text>
                  <View style={styles.pickerWrapper}>
                    {sports.map((sport) => (
                      <TouchableOpacity
                        key={sport.IdSport}
                        style={[styles.pickerItem, compSportId === String(sport.IdSport) && styles.pickerItemSelected]}
                        onPress={() => setCompSportId(String(sport.IdSport))}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            compSportId === String(sport.IdSport) && styles.pickerItemTextSelected,
                          ]}
                        >
                          {sport.Name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Godina (npr. 2025)"
                  value={compYear}
                  onChangeText={setCompYear}
                  keyboardType="numeric"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Otkaži</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={modalType === "sport" ? saveSport : saveCompetition}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Sačuvaj</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 5,
    margin: 15,
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  activeTab: {
    backgroundColor: "#10345bff",
  },
  tabText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#fff",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#e0e0e0",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardText: {
    marginLeft: 15,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 15,
  },
  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    backgroundColor: "#fa8d10ff",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  input: {
    height: 50,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
  },
  pickerItemSelected: {
    backgroundColor: "#10345bff",
    borderColor: "#10345bff",
  },
  pickerItemText: {
    fontSize: 14,
    color: "#333",
  },
  pickerItemTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  saveButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#10345bff",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default ManageSportCompetitionsScreen;
