import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  KeyboardAvoidingView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const TeamMembersScreen = ({ route }) => {
  const { user } = useAuth();
  const team = route.params?.team;
  const facultyId = route.params?.facultyId;

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [facultyUsers, setFacultyUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await apiClient.get(`/teams/${team.IdTeam}/members`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setMembers(res.data);
    } catch (err) {
      console.error("Error loading members:", err);
      showAlert("Greška", "Neuspješno učitavanje članova tima.");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadFacultyUsers = async () => {
    if (!facultyId) {
      console.warn("FacultyId nije prosleđen.");
      return;
    }
    setLoadingUsers(true);
    try {
      const res = await apiClient.get(`/teams/faculties/${facultyId}/users`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setFacultyUsers(res.data);
    } catch (err) {
      console.error("Error loading faculty users:", err);
      showAlert("Greška", "Neuspješno učitavanje korisnika fakulteta.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadMembers();
    loadFacultyUsers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMembers(), loadFacultyUsers()]);
    setRefreshing(false);
  };

  const addMember = async () => {
    if (!selectedUserId) {
      showAlert("Greška", "Odaberite korisnika.");
      return;
    }
    try {
      await apiClient.post(
        `/teams/${team.IdTeam}/members`,
        { userId: Number(selectedUserId) },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      showAlert("Uspjeh", "Korisnik je dodat u tim.");
      setSelectedUserId(null);
      loadMembers();
    } catch (err) {
      showAlert("Greška", err.response?.data?.message || "Neuspješno dodavanje korisnika.");
    }
  };

  const removeMember = async (memberId) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Da li želite ukloniti ovog člana?");
      if (!confirmed) return;
      try {
        await apiClient.delete(`/teams/${team.IdTeam}/members/${memberId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        loadMembers();
      } catch (err) {
        console.error("Greška pri uklanjanju člana:", err);
      }
    } else {
      Alert.alert("Potvrda", "Da li želite ukloniti ovog člana?", [
        { text: "Otkaži", style: "cancel" },
        {
          text: "Ukloni",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/teams/${team.IdTeam}/members/${memberId}`, {
                headers: { Authorization: `Bearer ${user.token}` },
              });
              Alert.alert("Uspjeh", "Član je uklonjen.");
              loadMembers();
            } catch (err) {
              Alert.alert("Greška", err.response?.data?.message || "Neuspješno uklanjanje člana.");
            }
          },
        },
      ]);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.MemberName} {item.MemberLastname}</Text>
      <Text style={styles.email}>{item.MemberEmail}</Text>
      <Text style={styles.verified}>{item.IsVerified ? "Verifikovan" : "Nije verifikovan"}</Text>
      <TouchableOpacity onPress={() => removeMember(item.MemberId)} style={styles.removeBtn}>
        <Ionicons name="trash-outline" size={20} color="red" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        {loadingMembers ? (
          <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(m) => String(m.MemberId)}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.empty}>Nema članova u timu.</Text>}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#10345bff"]}
                tintColor="#10345bff"
              />
            }
          />
        )}
      </View>

      {/* FOOTER ZA DODAVANJE - Fiksiran na dnu */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={styles.addSection}>
          <Text style={styles.addHeader}>Dodaj novog člana</Text>
          
          {loadingUsers ? (
            <ActivityIndicator color="#10345bff" style={{ padding: 20 }} />
          ) : facultyUsers.length === 0 ? (
            <Text style={styles.empty}>Nema dostupnih korisnika.</Text>
          ) : (
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedUserId}
                onValueChange={setSelectedUserId}
                style={styles.picker}
                dropdownIconColor="#10345bff"
                itemStyle={{ fontSize: 16, height: 140 }}
              >
                <Picker.Item label="-- Odaberite korisnika --" value={null} />
                {facultyUsers.map((u) => (
                  <Picker.Item
                    key={u.UserId}
                    label={`${u.UserName} ${u.UserLastname} (${u.UserEmail})`}
                    value={u.UserId}
                  />
                ))}
              </Picker>
            </View>
          )}

          <TouchableOpacity style={styles.addBtn} onPress={addMember}>
            <Text style={styles.addBtnText}>Dodaj u tim</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 6,
    borderRadius: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  name: { fontSize: 16, fontWeight: "bold", color: "#333" },
  email: { fontSize: 14, color: "#666", marginVertical: 2 },
  verified: { fontSize: 13, color: "#10345bff", marginTop: 4, fontWeight: "600" },
  removeBtn: { position: "absolute", right: 15, top: 15, padding: 5 },
  empty: { textAlign: "center", marginTop: 20, color: "#666" },
  
  // Sekcija za dodavanje (Footer)
  addSection: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15, // Dodatan padding na dnu za iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
    justifyContent: "flex-end",
  },
  addHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10345bff",
    marginBottom: 10,
    textAlign: "center"
  },
  
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    marginBottom: 15,
    height: Platform.OS === "ios" ? 100 : 55,
    overflow: "hidden", 
    justifyContent: "center",
  },
  picker: {
    width: "100%",
    height: Platform.OS === "ios" ? 100 : 55,
  },
  
  addBtn: {
    backgroundColor: "#10345bff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: Platform.OS === 'ios' ? 25 : 0, // Dodatni margin ispod dugmeta za iOS
  },
  addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});

export default TeamMembersScreen;