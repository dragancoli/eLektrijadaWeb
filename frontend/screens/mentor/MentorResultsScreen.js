import React, { useEffect, useState } from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

// Omogućava animacije na Androidu
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MentorResultsScreen = () => {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [users, setUsers] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [formData, setFormData] = useState({
    userId: "",
    questionNumber: "",
    score: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Accordion State
  const [expandedUserId, setExpandedUserId] = useState(null);

  // --- UČITAVANJE PODATAKA ---

  useEffect(() => {
    loadCompetitions();
  }, [user]);

  useEffect(() => {
    if (selectedCompetition) {
      loadUsersAndResults();
      setExpandedUserId(null); // Resetuj otvaranje kad se promijeni takmičenje
    }
  }, [selectedCompetition]);

  const loadCompetitions = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/sciences/mentors/${user.IdUser}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setCompetitions(response.data);
    } catch (error) {
      console.error("Error loading competitions:", error);
      Alert.alert("Greška", "Neuspješno učitavanje takmičenja.");
    } finally {
      setLoading(false);
    }
  };

  const loadUsersAndResults = async () => {
    if (!selectedCompetition) return;

    setUsersLoading(true);
    try {
      // 1. Učitaj korisnike
      const usersResponse = await apiClient.get(
        `/sciences/mentors/${user.IdUser}/competitions/${selectedCompetition.IdScienceCompetition}/users`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setUsers(usersResponse.data || []);

      // 2. Učitaj rezultate
      try {
        const resultsResponse = await apiClient.get(
          `/sciences/mentors/${user.IdUser}/competitions/${selectedCompetition.IdScienceCompetition}/results`,
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        setResults(resultsResponse.data || []);
      } catch (resultsError) {
        if (resultsError.response?.status === 404) {
          setResults([]);
        } else {
          throw resultsError;
        }
      }
    } catch (error) {
      setUsers([]);
      setResults([]);
    } finally {
      setUsersLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsersAndResults();
  };

  // --- LOGIKA INTERFEJSA ---

  const toggleUserExpand = (userId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
    }
  };

  const getUserName = (userId) => {
    const user = users.find((u) => u.IdUser === userId);
    return user ? `${user.Name} ${user.Lastname}` : "Nepoznat korisnik";
  };

  const getUserResults = (userId) => {
    return results.filter((result) => result.IdUser === userId && result.QuestionNumber != null) || [];
  };

  const getTotalScore = (userId) => {
    return getUserResults(userId).reduce((total, result) => total + (parseFloat(result.Score) || 0), 0);
  };

  // Grupiši podatke za listu
  const groupedResults = users.map((user) => ({
    user,
    results: getUserResults(user.IdUser),
    totalScore: getTotalScore(user.IdUser),
  }));

  // --- CRUD OPERACIJE ---

  const resetForm = () => {
    setFormData({ userId: "", questionNumber: "", score: "" });
    setEditingResult(null);
    setSubmitting(false);
  };

  const openAddModal = (user = null) => {
    if (user) {
      setFormData((prev) => ({ ...prev, userId: user.IdUser.toString() }));
    } else {
      setFormData((prev) => ({ ...prev, userId: "" }));
    }
    setEditingResult(null);
    setModalVisible(true);
  };

  const openEditModal = (result) => {
    setEditingResult(result);
    setFormData({
      userId: result.IdUser.toString(),
      questionNumber: result.QuestionNumber.toString(),
      score: result.Score.toString(),
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => { resetForm(); }, 300);
  };

  const handleSubmit = async () => {
    if (!formData.userId || !formData.questionNumber || !formData.score) {
      Alert.alert("Greška", "Sva polja su obavezna.");
      return;
    }

    const questionNumber = parseInt(formData.questionNumber);
    const score = parseFloat(formData.score);

    if (isNaN(questionNumber) || isNaN(score)) {
      Alert.alert("Greška", "Broj pitanja i bodovi moraju biti brojevi.");
      return;
    }

    setSubmitting(true);
    const payload = { userId: parseInt(formData.userId), questionNumber, score };

    try {
      const url = `/sciences/mentors/${user.IdUser}/competitions/${selectedCompetition.IdScienceCompetition}/results`;
      
      if (editingResult) {
        await apiClient.put(url, payload, { headers: { Authorization: `Bearer ${user.token}` } });
        Alert.alert("Uspjeh", "Rezultat ažuriran.");
      } else {
        await apiClient.post(url, payload, { headers: { Authorization: `Bearer ${user.token}` } });
        Alert.alert("Uspjeh", "Rezultat dodat.");
      }
      
      closeModal();
      setTimeout(() => { loadUsersAndResults(); }, 500);
    } catch (error) {
      Alert.alert("Greška", error.response?.data?.message || "Došlo je do greške.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (result) => {
    const deleteAction = async () => {
        try {
            await apiClient.delete(
              `/sciences/mentors/${user.IdUser}/competitions/${selectedCompetition.IdScienceCompetition}/results/${result.IdUser}/${result.QuestionNumber}`,
              { headers: { Authorization: `Bearer ${user.token}` } }
            );
            Platform.OS === 'web' ? window.alert("Obrisano!") : Alert.alert("Uspjeh", "Obrisano!");
            loadUsersAndResults();
          } catch (error) {
            console.error("Error deleting result:", error);
            Platform.OS === 'web' ? window.alert("Greška") : Alert.alert("Greška", "Neuspjeh brisanja.");
          }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Obriši rezultat?")) deleteAction();
    } else {
      Alert.alert("Potvrda", "Obriši rezultat?", [
        { text: "Otkaži", style: "cancel" },
        { text: "Obriši", style: "destructive", onPress: deleteAction },
      ]);
    }
  };

  // --- RENDER ---

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Unos rezultata takmičara</Text>

      {/* SEKCIJA 1: ODABIR TAKMIČENJA */}
      <View style={styles.pickerSection}>
        <Text style={styles.label}>Odaberite takmičenje:</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#10345bff" />
        ) : (
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedCompetition?.IdScienceCompetition?.toString() ?? ""}
              onValueChange={(value) => {
                if (value === "") setSelectedCompetition(null);
                else setSelectedCompetition(competitions.find(c => c.IdScienceCompetition === parseInt(value)) || null);
              }}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="-- Odaberite takmičenje --" value="" color="#888" />
              {competitions.map((c) => (
                <Picker.Item key={c.IdScienceCompetition} label={c.Science_Name} value={c.IdScienceCompetition.toString()} />
              ))}
            </Picker>
          </View>
        )}
      </View>

      {/* SEKCIJA 2: LISTA STUDENATA */}
      {selectedCompetition && (
        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Takmičari: {selectedCompetition.Science_Name}</Text>
          </View>

          {usersLoading && !refreshing ? (
            <ActivityIndicator size="large" color="#10345bff" style={styles.loader} />
          ) : groupedResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nema takmičara na ovom takmičenju</Text>
            </View>
          ) : (
            <FlatList
              data={groupedResults}
              keyExtractor={(item) => item.user.IdUser.toString()}
              renderItem={({ item }) => (
                <UserResultCard
                  item={item}
                  isExpanded={expandedUserId === item.user.IdUser}
                  onToggle={() => toggleUserExpand(item.user.IdUser)}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onAddResult={() => openAddModal(item.user)}
                />
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10345bff"]} />}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingResult ? "Ažuriraj rezultat" : "Dodaj novi rezultat"}</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                <Text style={styles.modalLabel}>Takmičar *</Text>
                <View style={styles.pickerContainer}>
                    {formData.userId ? (
                    <View style={styles.selectedUserContainer}>
                        <Text style={styles.selectedUser}>{getUserName(parseInt(formData.userId))}</Text>
                        <TouchableOpacity onPress={() => setFormData((prev) => ({ ...prev, userId: "" }))} style={styles.clearSelection}>
                        <Ionicons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                    </View>
                    ) : (
                    <ScrollView style={styles.usersScroll} nestedScrollEnabled={true}>
                        {users.map((user) => (
                        <TouchableOpacity key={user.IdUser} style={styles.userOption} onPress={() => setFormData((prev) => ({ ...prev, userId: user.IdUser.toString() }))}>
                            <Text style={styles.userOptionText}>{user.Name} {user.Lastname} ({user.Email})</Text>
                        </TouchableOpacity>
                        ))}
                    </ScrollView>
                    )}
                </View>

                <Text style={styles.modalLabel}>Broj pitanja *</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={formData.questionNumber} onChangeText={(t) => setFormData(p => ({ ...p, questionNumber: t.replace(/[^0-9]/g, "") }))} placeholder="Unesite redni broj pitanja" editable={!submitting} />

                <Text style={styles.modalLabel}>Broj bodova *</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={formData.score} onChangeText={(t) => setFormData(p => ({ ...p, score: t.replace(/[^0-9.,]/g, "").replace(",", ".") }))} placeholder="Unesite broj bodova" editable={!submitting} />
                </ScrollView>

                <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal} disabled={submitting}><Text style={styles.cancelButtonText}>Otkaži</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
                    {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>{editingResult ? "Ažuriraj" : "Dodaj"}</Text>}
                </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// --- KOMPONENTA KARTICE STUDENTA (Accordion) ---
const UserResultCard = ({ item, isExpanded, onToggle, onEdit, onDelete, onAddResult }) => {
  const totalScore = typeof item.totalScore === "number" ? item.totalScore : 0;
  const hasResults = item.results && item.results.length > 0;

  return (
    <View style={cardStyles.userCard}>
      {/* HEADER (Uvijek vidljiv) */}
      <TouchableOpacity 
        style={cardStyles.userHeader} 
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={cardStyles.userInfo}>
          <Text style={cardStyles.userName}>{item.user.Name} {item.user.Lastname}</Text>
          <Text style={cardStyles.userEmail}>{item.user.Email}</Text>
        </View>
        
        <View style={cardStyles.headerRight}>
            {/* Prikazuj bodove samo ako ima rezultata, inace crtica ili 0 */}
            <Text style={[cardStyles.totalScore, !hasResults && { color: '#999' }]}>
                {hasResults ? `${totalScore.toFixed(2)} b.` : "0 b."}
            </Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color="#666" style={{marginLeft: 8}} />
        </View>
      </TouchableOpacity>

      {/* BODY (Vidljiv samo kad je otvoren) */}
      {isExpanded && (
        <View style={cardStyles.cardBody}>
            <View style={cardStyles.divider} />
            
            {!hasResults ? (
                // --- PROMJENA OVDJE ---
                <View style={cardStyles.emptyResultContainer}>
                    <Ionicons name="clipboard-outline" size={30} color="#ccc" />
                    <Text style={cardStyles.noResultsText}>Korisnik nema rezultata</Text>
                </View>
            ) : (
                <FlatList
                data={item.results}
                keyExtractor={(result) => `${result.IdUser}-${result.QuestionNumber}`}
                renderItem={({ item: res }) => (
                    <View style={cardStyles.resultItem}>
                    <View style={cardStyles.resultInfo}>
                        <Text style={cardStyles.resultText}>
                        <Text style={{fontWeight:'bold'}}>Pitanje {res.QuestionNumber}:</Text> {res.Score} bodova
                        </Text>
                    </View>
                    <View style={cardStyles.resultActions}>
                        <TouchableOpacity style={cardStyles.editButton} onPress={() => onEdit(res)}>
                        <Ionicons name="create-outline" size={20} color="#10345bff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={cardStyles.deleteButton} onPress={() => onDelete(res)}>
                        <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                        </TouchableOpacity>
                    </View>
                    </View>
                )}
                scrollEnabled={false}
                />
            )}

            <TouchableOpacity style={cardStyles.addResultButton} onPress={onAddResult}>
                <Ionicons name="add-circle-outline" size={18} color="#10345bff" />
                <Text style={cardStyles.addResultButtonText}>Dodaj rezultat</Text>
            </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// --- STILOVI KARTICE ---
const cardStyles = StyleSheet.create({
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden', 
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
  },
  userInfo: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  userName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  userEmail: { fontSize: 13, color: "#777", marginTop: 2 },
  totalScore: { fontSize: 15, fontWeight: "700", color: "#10345bff" },
  cardBody: { paddingHorizontal: 15, paddingBottom: 15, backgroundColor: "#fafafa" },
  divider: { height: 1, backgroundColor: "#eee", marginBottom: 10 },
  
  // --- NOVI STILOVI ZA PRAZAN REZULTAT ---
  emptyResultContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 5
  },
  noResultsText: { 
    fontSize: 14, 
    color: "#888", 
    fontStyle: "italic", 
    textAlign: "center" 
  },
  // ---------------------------------------

  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultInfo: { flex: 1 },
  resultText: { fontSize: 15, color: "#333" },
  resultActions: { flexDirection: "row", gap: 12 },
  editButton: { padding: 4 },
  deleteButton: { padding: 4 },
  addResultButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8efff",
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
    gap: 6,
  },
  addResultButtonText: { color: "#10345bff", fontWeight: "600", fontSize: 14 },
});

// --- GLAVNI STILOVI ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f5f5f5", 
    // FIX: Dodan padding lijevo/desno
    paddingHorizontal: 30, 
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: { 
    fontSize: 22, 
    fontWeight: "bold", 
    marginBottom: 20, 
    textAlign: "center", 
    color: "#10345bff" 
  },
  
  // FIX: Picker sekcija više ne uzima sav prostor (flex: 1 uklonjen)
  pickerSection: { 
    marginBottom: 10, // Smanjen razmak između pickera i liste
  },

  // FIX: Lista uzima sav preostali prostor
  listSection: {
    flex: 1, 
    marginTop: 0,
  },

  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#333" },
  pickerWrapper: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, overflow: "hidden" },
  picker: { width: "100%", color: "#333" },
  pickerItem: { height: 44 },
  
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333", flex: 1 },
  loader: { marginVertical: 20 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { textAlign: "center", color: "#666", fontSize: 16, marginTop: 10 },
  
  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 16, width: "100%", maxHeight: "80%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#10345bff", flex: 1 },
  closeButton: { padding: 4 },
  modalBody: { padding: 20, maxHeight: 400 },
  modalLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#333" },
  pickerContainer: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 16, maxHeight: 150, backgroundColor: "#fafafa" },
  selectedUserContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  selectedUser: { fontSize: 16, color: "#333", flex: 1 },
  clearSelection: { padding: 4 },
  usersScroll: { maxHeight: 120 },
  userOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  userOptionText: { fontSize: 14, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "#fff" },
  modalFooter: { flexDirection: "row", gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cancelButton: { backgroundColor: "#f8f9fa", borderWidth: 1, borderColor: "#ddd" },
  submitButton: { backgroundColor: "#10345bff" },
  submitButtonDisabled: { backgroundColor: "#ccc", opacity: 0.6 },
  cancelButtonText: { color: "#333", fontWeight: "600", fontSize: 16 },
  submitButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

export default MentorResultsScreen