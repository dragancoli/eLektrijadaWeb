import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  LayoutAnimation,
  UIManager,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

const primary = "#10345bff";
const orange = "#fa8d10ff";
const danger = "#d64545";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MentorCompetitionsScreen = () => {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [updates, setUpdates] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  // DateTime picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidPickingTime, setAndroidPickingTime] = useState(false);
  const [activePickerId, setActivePickerId] = useState(null);

  const formatDateTimeLocal = (date) => {
    if (!date) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadCompetitions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/sciences/mentors/${user.IdUser}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setCompetitions(res.data);
    } catch (err) {
      console.error(err);
      showAlert("Greška", "Neuspješno učitavanje takmičenja.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    setRefreshing(false);
  };

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);

    // Reset picker state when switching cards
    setShowDatePicker(false);
    setAndroidPickingTime(false);
    setActivePickerId(null);
  };

  const handleUpdateField = (id, field, value) => {
    setUpdates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // --- ANDROID DATE/TIME LOGIC ---
  const startAndroidPicker = (id) => {
    setActivePickerId(id);
    setAndroidPickingTime(false);
    setShowDatePicker(true);
  };

  const onChangeAndroidDate = (event, pickedDate, id) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    const currentVal = updates[id]?.StartDate ? new Date(updates[id].StartDate) : new Date();
    const base = pickedDate || new Date();
    const withDate = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      currentVal.getHours(),
      currentVal.getMinutes()
    );
    handleUpdateField(id, "StartDate", withDate.toISOString());
    setShowDatePicker(false);
    setAndroidPickingTime(true);
  };

  const onChangeAndroidTime = (event, pickedTime, id) => {
    if (event.type === "dismissed") {
      setAndroidPickingTime(false);
      return;
    }
    const currentVal = updates[id]?.StartDate ? new Date(updates[id].StartDate) : new Date();
    const time = pickedTime || new Date();
    const withTime = new Date(
      currentVal.getFullYear(),
      currentVal.getMonth(),
      currentVal.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    handleUpdateField(id, "StartDate", withTime.toISOString());
    setAndroidPickingTime(false);
    setActivePickerId(null);
  };

  const validateReviewAppointmentBeforeSave = (competitionId) => {
    const body = updates[competitionId] || {};

    // If user is trying to create/update review appointment, make sure all required fields exist when creating new.
    // Backend requires all 3 fields only when creating a new appointment; but frontend can warn early.
    const isTouchingReview =
      body.StartDate !== undefined || body.Duration !== undefined || body.Location !== undefined;

    if (!isTouchingReview) return { ok: true };

    const existing = competitions.find((c) => c.IdScienceCompetition === competitionId);
    const hasExistingReview = !!existing?.Review_Appointment_Date;

    // When no existing review appointment, enforce all 3 to avoid 400
    if (!hasExistingReview) {
      const start = body.StartDate ?? existing?.Review_Appointment_Date;
      const dur = body.Duration ?? existing?.Review_Appointment_Duration;
      const loc = body.Location ?? existing?.Review_Appointment_Location;

      if (!start || !dur || !loc) {
        return {
          ok: false,
          message: "Za kreiranje termina uvida potrebno je unijeti datum i vrijeme, trajanje i lokaciju.",
        };
      }
    }

    return { ok: true };
  };

  const submitUpdate = async (competitionId) => {
    const body = updates[competitionId];
    if (!body || Object.keys(body).length === 0) {
      showAlert("Info", "Nema izmjena za slanje.");
      return;
    }

    const v = validateReviewAppointmentBeforeSave(competitionId);
    if (!v.ok) {
      showAlert("Info", v.message);
      return;
    }

    try {
      await apiClient.put(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}`, body, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      showAlert("Uspjeh", "Podaci su ažurirani.");
      setUpdates((prev) => ({ ...prev, [competitionId]: {} }));
      loadCompetitions();
    } catch (err) {
      showAlert("Greška", err.response?.data?.message || "Neuspješno ažuriranje.");
    }
  };

  const removeReviewAppointment = (competitionId) => {
    const existing = competitions.find((c) => c.IdScienceCompetition === competitionId);
    const hasExistingReview = !!existing?.Review_Appointment_Date;

    const hasPendingInputs = !!(
      updates[competitionId]?.StartDate ||
      updates[competitionId]?.Duration ||
      updates[competitionId]?.Location
    );

    if (!hasExistingReview && !hasPendingInputs) {
      showAlert("Info", "Ovo takmičenje nema termin uvida.");
      return;
    }

    const confirmAction = async () => {
      try {
        await apiClient.put(
          `/sciences/mentors/${user.IdUser}/competitions/${competitionId}`,
          { RemoveReviewAppointment: true },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        setUpdates((prev) => ({ ...prev, [competitionId]: {} }));
        loadCompetitions();
      } catch (err) {
        showAlert("Greška", err.response?.data?.message || "Neuspješno uklanjanje termina uvida.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Ukloni termin uvida\n\nDa li ste sigurni? Termin uvida će biti uklonjen.")) {
        confirmAction();
      }
    } else {
      Alert.alert(
        "Ukloni termin uvida",
        "Da li ste sigurni? Termin uvida će biti uklonjen.",
        [
          { text: "Odustani", style: "cancel" },
          {
            text: "Ukloni",
            style: "destructive",
            onPress: confirmAction,
          },
        ]
      );
    }
  };

  const pickSolutionFile = async (competitionId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (result.canceled) return;
      uploadFile(competitionId, result.assets[0]);
    } catch (err) {
      showAlert("Greška", "Greška pri odabiru fajla.");
    }
  };

  const uploadFile = async (competitionId, file) => {
    setUploadingId(competitionId);
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append("document", blob, file.name);
      } else {
        formData.append("document", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
        });
      }

      await apiClient.post(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}/solution`, formData, {
        headers: { Authorization: `Bearer ${user.token}`, Accept: "application/json" },
        transformRequest: (data) => data,
      });

      showAlert("Upload završen", "Rješenje je uspješno postavljeno na server!");
      loadCompetitions();
    } catch (err) {
      showAlert("Greška", "Neuspješan upload.");
    } finally {
      setUploadingId(null);
    }
  };

  // NOTE: this is Review Appointment (Termin uvida), not competition appointment
  const renderReviewDateInput = (item) => {
    const id = item.IdScienceCompetition;
    const currentValStr = updates[id]?.StartDate || item.Review_Appointment_Date;
    const currentDate = currentValStr ? new Date(currentValStr) : null;

    if (Platform.OS === "web") {
      const toLocalInputValue = (date) => {
        if (!date) return "";
        const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 16);
      };
      return (
        <input
          type="datetime-local"
          value={toLocalInputValue(currentDate)}
          onChange={(e) => {
            const val = e.target.value;
            handleUpdateField(id, "StartDate", val ? new Date(val).toISOString() : null);
          }}
          style={styles.webDateInput}
        />
      );
    }

    if (Platform.OS === "android") {
      return (
        <>
          <TouchableOpacity style={styles.dateDisplay} onPress={() => startAndroidPicker(id)}>
            <Ionicons name="calendar-outline" size={18} color={primary} />
            <Text style={styles.dateDisplayText}>
              {currentDate ? formatDateTimeLocal(currentDate) : "Odaberite datum i vrijeme uvida"}
            </Text>
          </TouchableOpacity>

          {showDatePicker && activePickerId === id && (
            <DateTimePicker value={currentDate || new Date()} mode="date" onChange={(ev, date) => onChangeAndroidDate(ev, date, id)} />
          )}
          {androidPickingTime && activePickerId === id && (
            <DateTimePicker value={currentDate || new Date()} mode="time" onChange={(ev, date) => onChangeAndroidTime(ev, date, id)} />
          )}
        </>
      );
    }

    return (
      <>
        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => {
            setActivePickerId(id);
            setShowDatePicker(!showDatePicker);
          }}
        >
          <Ionicons name="calendar-outline" size={18} color={primary} />
          <Text style={styles.dateDisplayText}>
            {currentDate ? formatDateTimeLocal(currentDate) : "Odaberite datum i vrijeme uvida"}
          </Text>
        </TouchableOpacity>

        {showDatePicker && activePickerId === id && (
          <DateTimePicker
            value={currentDate || new Date()}
            mode="datetime"
            display="inline"
            onChange={(event, date) => {
              if (date) handleUpdateField(id, "StartDate", date.toISOString());
            }}
          />
        )}
      </>
    );
  };

  const renderItem = ({ item }) => {
    const id = item.IdScienceCompetition;
    const update = updates[id] || {};
    const isExpanded = expandedId === id;
    const isUploading = uploadingId === id;

    const hasReview = !!item.Review_Appointment_Date;

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(id)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.Science_Name}</Text>
            <Text style={styles.subtitle}>Godina: {item.Year || "N/A"}</Text>
          </View>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color={primary} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Broj pitanja</Text>
              <View style={styles.inputIconField}>
                <Ionicons name="help-circle-outline" size={18} color={primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputIconText}
                  keyboardType="numeric"
                  value={update.NumberOfQuestions?.toString() ?? item.NumberOfQuestions?.toString() ?? ""}
                  onChangeText={(val) => handleUpdateField(id, "NumberOfQuestions", val)}
                  placeholder="npr. 10"
                />
              </View>
            </View>

            {/* Termin uvida (opciono) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Termin uvida</Text>
              <Text style={styles.sectionSub}>{hasReview ? "Postavljen" : "Nije postavljen"}</Text>
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Datum i vrijeme uvida</Text>
              {renderReviewDateInput(item)}
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Trajanje uvida (min)</Text>
              <View style={styles.inputIconField}>
                <Ionicons name="time-outline" size={18} color={primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputIconText}
                  keyboardType="numeric"
                  value={update.Duration?.toString() ?? item.Review_Appointment_Duration?.toString() ?? ""}
                  onChangeText={(val) => handleUpdateField(id, "Duration", val)}
                  placeholder="npr. 15"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Lokacija uvida</Text>
              <View style={styles.inputIconField}>
                <Ionicons name="location-outline" size={18} color={primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputIconText}
                  value={update.Location ?? item.Review_Appointment_Location ?? ""}
                  onChangeText={(val) => handleUpdateField(id, "Location", val)}
                  placeholder="Lokacija uvida"
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.updateBtn} onPress={() => submitUpdate(id)}>
                <Text style={styles.updateBtnText}>SAČUVAJ IZMJENE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeReviewAppointment(id)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.deleteBtnText}>UKLONI TERMIN UVIDA</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadBtn} onPress={() => pickSolutionFile(id)} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={styles.uploadBtnText}>UPLOAD RJEŠENJA</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>Upravljanje takmičenjima</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <FlatList
          data={competitions}
          keyExtractor={(item) => String(item.IdScienceCompetition)}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Nema dodijeljenih takmičenja.</Text>}
          contentContainerStyle={{ paddingBottom: 40 }}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 15, paddingBottom: 50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  screenTitle: { fontSize: 24, fontWeight: "bold", color: "#333", marginVertical: 15 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 15 },
  title: { fontSize: 17, fontWeight: "700", color: "#333" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  cardBody: { padding: 15, borderTopWidth: 1, borderTopColor: "#f0f0f0", backgroundColor: "#fcfcfc" },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeader: { fontSize: 14, fontWeight: "800", color: primary },
  sectionSub: { fontSize: 12, color: "#666" },

  inputRow: { marginBottom: 12 },
  inputLabel: { fontSize: 13, color: "#555", marginBottom: 6, fontWeight: "600" },
  inputIconField: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  inputIcon: { marginRight: 8 },
  inputIconText: { flex: 1, fontSize: 15, color: "#333" },

  dateDisplay: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateDisplayText: { fontSize: 15, color: "#333", flex: 1 },
  webDateInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    padding: "0 12px",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
  },

  buttonRow: { gap: 10, marginTop: 15 },
  updateBtn: { backgroundColor: primary, padding: 14, borderRadius: 10, alignItems: "center" },
  updateBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  deleteBtn: { backgroundColor: danger, padding: 14, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  uploadBtn: { backgroundColor: orange, padding: 14, borderRadius: 10, alignItems: "center" },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  empty: { textAlign: "center", marginTop: 40, color: "#999" },
});

export default MentorCompetitionsScreen;