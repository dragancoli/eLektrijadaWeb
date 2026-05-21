import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const primary = "#10345bff";

const TeamLeaderVerificationScreen = () => {
  const { user } = useAuth();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 3 = Student, 7 = VodjaTima
  const [selectedAccountType, setSelectedAccountType] = useState(3);
  const [searchQuery, setSearchQuery] = useState("");

  // modal state
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const canAccess = user?.IdUserType === 5 || user?.IdUserType === 1; // koordinator sport ili admin

  const fetchUsers = async () => {
    if (!canAccess) return;
    try {
      setLoading(true);
      const params = { userType: selectedAccountType };
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get("/team-leader-verification", {
        headers: { Authorization: `Bearer ${user?.token}` },
        params,
      });

      setData(res.data || []);
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountType]);

  // Search debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountType, searchQuery]);

  const updateUserType = async (id, newUserTypeId) => {
    try {
      setSubmitting(true);
      const res = await apiClient.put(
        `/team-leader-verification/${id}`,
        { newUserTypeId },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );

      showAlert("OK", res.data?.message || "Sačuvano.");
      setData((prev) => prev.filter((u) => u.IdUser !== id));
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno.");
    } finally {
      setSubmitting(false);
      setRoleModalVisible(false);
      setSelectedUser(null);
    }
  };

  const openModal = (userObj) => {
    setSelectedUser(userObj);
    setRoleModalVisible(true);
  };

  const handlePick = (typeId) => {
    if (!selectedUser) return;
    updateUserType(selectedUser.IdUser, typeId);
  };

  const handleAccountTypeChange = (type) => {
    setSelectedAccountType(type);
    setSearchQuery("");
  };

  const getAccountTypeName = () => {
    switch (selectedAccountType) {
      case 7:
        return "Vođa tima";
      default:
        return "Student";
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openModal(item)} disabled={submitting}>
      <View style={styles.avatar}>
        <Ionicons name="person-outline" size={28} color="#fff" />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.Name} {item.Lastname}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {item.Email}
        </Text>
        <View style={styles.facultyPill}>
          <Ionicons name="school-outline" size={14} color={primary} />
          <Text style={styles.facultyText}>{item.FacultyName}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  if (!canAccess) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#999" />
        <Text style={styles.denied}>Nemate ovlaštenje za ovu stranicu.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verifikacija vođe tima (sport)</Text>

      {/* Tip naloga */}
      <View style={styles.accountTypeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, selectedAccountType === 3 && styles.typeButtonActive]}
          onPress={() => handleAccountTypeChange(3)}
        >
          <Text style={[styles.typeButtonText, selectedAccountType === 3 && styles.typeButtonTextActive]}>
            Student
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, selectedAccountType === 7 && styles.typeButtonActive]}
          onPress={() => handleAccountTypeChange(7)}
        >
          <Text style={[styles.typeButtonText, selectedAccountType === 7 && styles.typeButtonTextActive]}>
            Vođa tima
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pretraga */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Pretraži ${getAccountTypeName().toLowerCase()}e po imenu i prezimenu`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={42} color={primary} />
          <Text style={styles.emptyText}>{searchQuery ? "Nema rezultata pretrage." : `Nema ${getAccountTypeName().toLowerCase()}a.`}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.IdUser)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* Modal za akciju */}
      <Modal
        transparent
        visible={roleModalVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) {
            setRoleModalVisible(false);
            setSelectedUser(null);
          }
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            if (!submitting) {
              setRoleModalVisible(false);
              setSelectedUser(null);
            }
          }}
        >
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Promjena tipa naloga</Text>

            <Text style={styles.modalSubtitle}>
              {selectedAccountType === 3
                ? `Postavi ${selectedUser?.Name} ${selectedUser?.Lastname} kao Vođu tima?`
                : `Ukloni permisije Vođe tima za ${selectedUser?.Name} ${selectedUser?.Lastname} (degradiraj u studenta)?`}
            </Text>

            {selectedAccountType === 3 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.actionButton, submitting && styles.disabled]}
                onPress={() => handlePick(7)}
                disabled={submitting}
              >
                <Text style={styles.actionButtonLabel}>POSTAVI VOĐU TIMA</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.demoteButton, submitting && styles.disabled]}
                onPress={() => handlePick(3)}
                disabled={submitting}
              >
                <Text style={styles.demoteButtonLabel}>UKLONI PERMISIJE (STUDENT)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                if (!submitting) {
                  setRoleModalVisible(false);
                  setSelectedUser(null);
                }
              }}
              style={styles.cancelButton}
              disabled={submitting}
            >
              <Text style={styles.cancelLabel}>OTKAŽI</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 15, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15, color: "#333", textAlign: "left" },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    outlineStyle: "solid",
    outlineWidth: Platform.OS === "web" ? 1 : 0,
    outlineColor: "#e0e0e0",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 3 },
  email: { fontSize: 12, color: "#666", marginBottom: 6 },
  facultyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3FF",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  facultyText: { fontSize: 12, color: primary, fontWeight: "600" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  denied: { marginTop: 10, fontSize: 16, color: "#999" },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { marginTop: 10, fontSize: 16, color: "#666" },

  accountTypeSelector: { flexDirection: "row", gap: 10, marginBottom: 15 },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  typeButtonActive: { backgroundColor: primary, borderColor: primary },
  typeButtonText: { fontSize: 14, fontWeight: "600", color: "#666" },
  typeButtonTextActive: { color: "#fff" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: "#333" },
  clearButton: { padding: 5 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 30,
    paddingRight: 20,
    paddingBottom: 40,
    paddingLeft: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#222", marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: "#666", marginBottom: 22 },

  actionButton: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "#eef1f5",
    marginBottom: 10,
  },
  actionButtonLabel: { fontSize: 15, fontWeight: "700", color: primary, letterSpacing: 0.3 },

  demoteButton: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "#eef1f5",
    marginBottom: 10,
  },
  demoteButtonLabel: { fontSize: 15, fontWeight: "700", color: "#d32f2f", letterSpacing: 0.3 },

  cancelButton: { position: "absolute", right: 16, bottom: 12, paddingHorizontal: 6, paddingVertical: 4 },
  cancelLabel: { color: primary, fontSize: 14, fontWeight: "600" },

  disabled: { opacity: 0.5 },
});

export default TeamLeaderVerificationScreen;