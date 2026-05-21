import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";

const primary = "#10345bff";
const orange = "#fa8d10ff";

// Cross-platform alert
const showAlert = (title, message, buttons = null, options = {}) => {
  if (Platform.OS === "web") {
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message || ""}`);
      const actionButton = buttons.find((b) => b.style === "destructive" || b.text === "DA");
      if (confirmed && actionButton && actionButton.onPress) {
        actionButton.onPress();
      }
    } else {
      window.alert(`${title}\n\n${message || ""}`);
    }
  } else {
    if (buttons) {
      Alert.alert(title, message, buttons, options);
    } else {
      Alert.alert(title, message);
    }
  }
};

let fetchTimer = null;
const debounceFetch = async (fn) => {
  if (fetchTimer) clearTimeout(fetchTimer);
  await new Promise((resolve) => {
    fetchTimer = setTimeout(resolve, 150);
  });
  return fn();
};

const isNumber = (val) => {
  if (val === "" || val === null || val === undefined) return false;
  const n = Number(val);
  return Number.isFinite(n);
};

/**
 * DropdownSelect
 */
const DropdownSelect = ({
  label,
  items,
  value,
  onChange,
  placeholder = "Odaberite...",
  loading = false,
  searchable = false,
  onSearchChange,
  iconName,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const selectedItem = useMemo(() => items.find((i) => String(i.value) === String(value)), [items, value]);
  const [localQuery, setLocalQuery] = useState("");

  useEffect(() => {
    if (!modalOpen) setLocalQuery("");
  }, [modalOpen]);

  const filteredItems = useMemo(() => {
    const q = (localQuery || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const hay = [i.label, i.subtitle].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, localQuery]);

  return (
    <View style={styles.inputRow}>
      {!!label && <Text style={styles.inputLabel}>{label}</Text>}
      <TouchableOpacity style={styles.selectField} activeOpacity={0.7} onPress={() => setModalOpen(true)}>
        {iconName ? <Ionicons name={iconName} size={18} color={primary} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.selectFieldText, !selectedItem && { color: "#999" }]}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#999" />
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.dropdownModalCard}>
            <Text style={styles.modalTitle}>{label || "Odabir"}</Text>

            {searchable ? (
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#666" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pretraga..."
                  value={localQuery}
                  onChangeText={(val) => {
                    setLocalQuery(val);
                    onSearchChange && onSearchChange(val);
                  }}
                  autoCapitalize="none"
                />
              </View>
            ) : null}

            {loading ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={primary} />
                <Text style={{ marginTop: 8, color: "#666" }}>Učitavanje...</Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Ionicons name="alert-circle-outline" size={20} color="#999" />
                <Text style={{ marginTop: 8, color: "#666" }}>Nema rezultata.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                {filteredItems.map((it) => {
                  const isSelected = String(it.value) === String(value);
                  return (
                    <TouchableOpacity
                      key={String(it.value)}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                      onPress={() => {
                        onChange(String(it.value));
                        setModalOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemLabel}>{it.label}</Text>
                      {!!it.subtitle && <Text style={styles.dropdownItemSubtitle}>{it.subtitle}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalOpen(false)}>
              <Text style={styles.cancelLabel}>OTKAŽI</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const ScienceCompetitionsScreen = () => {
  const { user } = useAuth();
  const canAccess = user?.IdUserType === 4 || user?.IdUserType === 1;

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("create"); // "create" | "edit"
  const [selected, setSelected] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [fScienceId, setFScienceId] = useState("");
  const [fYear, setFYear] = useState("");
  const [fYearTouched, setFYearTouched] = useState(false); // NEW: user manually changed year
  const [fMentorId, setFMentorId] = useState("");
  const [fNumberOfQuestions, setFNumberOfQuestions] = useState("");
  const [fSolutionUrl, setFSolutionUrl] = useState("");
  const [fSolutionFile, setFSolutionFile] = useState(null);
  const [fStartDate, setFStartDate] = useState(null);
  const [fDuration, setFDuration] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Android date-time sequence
  const [androidPickingTime, setAndroidPickingTime] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Picker data
  const [sciences, setSciences] = useState([]);
  const [loadingSciences, setLoadingSciences] = useState(false);

  const [mentors, setMentors] = useState([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [mentorsQuery, setMentorsQuery] = useState("");

  // safer cross-platform timer (instead of window.__mentorsTimer)
  const mentorsTimerRef = useRef(null);

  const resetForm = () => {
    setFScienceId("");
    setFYear("");
    setFYearTouched(false); // NEW
    setFMentorId("");
    setFNumberOfQuestions("");
    setFSolutionUrl("");
    setFSolutionFile(null);
    setFStartDate(null);
    setFDuration("");
    setFLocation("");
    setShowDatePicker(false);
    setAndroidPickingTime(false);
    setMentorsQuery("");

    if (mentorsTimerRef.current) clearTimeout(mentorsTimerRef.current);
    mentorsTimerRef.current = null;
  };

  // NEW: auto-fill Year from StartDate unless user touched Year manually
  useEffect(() => {
    if (fStartDate instanceof Date && !isNaN(fStartDate.getTime())) {
      if (!fYearTouched) {
        setFYear(String(fStartDate.getFullYear()));
      }
    }
  }, [fStartDate, fYearTouched]);

  const openCreate = async () => {
    resetForm();
    setFormMode("create");
    setFormModalOpen(true);
    await Promise.all([loadSciences(), loadMentors("")]);
  };

  const openEdit = async (item) => {
    setFormMode("edit");
    const base = item || {};

    try {
      const res = await apiClient.get(`/science-competitions/${base.IdScienceCompetition}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const full = res.data || base;
      setSelected(full);

      setFScienceId(full.IdScience ? String(full.IdScience) : "");

      // IMPORTANT: set StartDate first, Year will auto-fill if not touched
      const sd = full.StartDate ? new Date(full.StartDate) : null;
      setFStartDate(sd);

      // We keep backend Year if it exists, but mark it as NOT touched.
      // If you want Year ALWAYS equals StartDate year, you can remove this and rely only on auto-fill.
      setFYear(full.Year ? String(full.Year) : (sd ? String(sd.getFullYear()) : ""));
      setFYearTouched(false);

      setFMentorId(full.IdMentor ? String(full.IdMentor) : "");
      setFNumberOfQuestions(typeof full.NumberOfQuestions === "number" ? String(full.NumberOfQuestions) : "");
      setFSolutionUrl(full.SolutionUrl || "");
      setFDuration(full.Duration ? String(full.Duration) : "");
      setFLocation(full.Location || "");
    } catch (e) {
      setSelected(base);

      setFScienceId(base.IdScience ? String(base.IdScience) : "");

      const sd = base.StartDate ? new Date(base.StartDate) : null;
      setFStartDate(sd);

      setFYear(base.Year ? String(base.Year) : (sd ? String(sd.getFullYear()) : ""));
      setFYearTouched(false);

      setFMentorId(base.IdMentor ? String(base.IdMentor) : "");
      setFNumberOfQuestions(typeof base.NumberOfQuestions === "number" ? String(base.NumberOfQuestions) : "");
      setFSolutionUrl(base.SolutionUrl || "");
      setFDuration(base.Duration ? String(base.Duration) : "");
      setFLocation(base.Location || "");
    }

    setFormModalOpen(true);
    await Promise.all([loadSciences(), loadMentors("")]);
  };

  const fetchList = async () => {
    if (!canAccess) return;
    try {
      setLoading(true);
      const res = await apiClient.get("/science-competitions", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setList(res.data || []);
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje takmičenja.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  }, []);

  const loadSciences = async () => {
    try {
      setLoadingSciences(true);
      const res = await apiClient.get("/sciences", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const mapped = (res.data || []).map((s) => ({
        label: s.Name,
        value: s.IdScience,
      }));
      setSciences(mapped);
    } catch (e) {
      setSciences([]);
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje nauka.");
    } finally {
      setLoadingSciences(false);
    }
  };

  const loadMentors = async (q = "") => {
    try {
      setLoadingMentors(true);
      const res = await apiClient.get("/sciences/mentors", {
        headers: { Authorization: `Bearer ${user?.token}` },
        params: { q, limit: 100, offset: 0 },
      });
      const mapped = (res.data || []).map((m) => ({
        label: [m.Name, m.Lastname].filter(Boolean).join(" "),
        value: m.IdUser,
        subtitle: m.FacultyName || "",
      }));
      setMentors(mapped);
    } catch (e) {
      setMentors([]);
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje mentora.");
    } finally {
      setLoadingMentors(false);
    }
  };

  const confirmDelete = (item) => {
    showAlert(
      "Potvrda brisanja",
      "Da li ste sigurni da želite obrisati ovo takmičenje?",
      [
        { text: "NE", onPress: () => {}, style: "cancel" },
        { text: "DA", onPress: () => handleDelete(item), style: "destructive" },
      ],
      { cancelable: true }
    );
  };

  const handleDelete = async (item) => {
    setSubmitting(true);
    try {
      await apiClient.delete(`/science-competitions/${item.IdScienceCompetition}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      setActionModalOpen(false);
      setSelected(null);

      await debounceFetch(fetchList);

      showAlert("Uspjeh", "Takmičenje je uspješno obrisano.");
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Brisanje nije uspjelo.";
      showAlert("Greška", reason);
    } finally {
      setSubmitting(false);
    }
  };

  // Validacije
  const errorIfNotPositiveInt = (label, val) => {
    if (!isNumber(val)) return `${label} mora biti broj.`;
    const n = Number(val);
    if (!Number.isInteger(n)) return `${label} mora biti cijeli broj.`;
    if (n <= 0) return `${label} mora biti pozitivan broj.`;
    return null;
  };

  const errorIfNegativeInt = (label, val) => {
    if (val === "" || val === null || val === undefined) return null;
    if (!isNumber(val)) return `${label} mora biti broj.`;
    const n = Number(val);
    if (!Number.isInteger(n)) return `${label} mora biti cijeli broj.`;
    if (n < 0) return `${label} ne može biti negativan broj.`;
    return null;
  };

  const validateCreate = () => {
    const errors = [];

    if (!fStartDate || !(fStartDate instanceof Date) || isNaN(fStartDate.getTime())) {
      errors.push("Datum početka je obavezan.");
    }

    if (!fScienceId) {
      errors.push("Nauka se mora odabrati.");
    } else {
      const eSci = errorIfNotPositiveInt("Nauka", fScienceId);
      if (eSci) errors.push(eSci);
    }

    if (!fMentorId) {
      errors.push("Mentor se mora odabrati.");
    } else {
      const eMent = errorIfNotPositiveInt("Mentor", fMentorId);
      if (eMent) errors.push(eMent);
    }

    const eYear = errorIfNotPositiveInt("Godina", fYear);
    if (eYear) errors.push(eYear);

    const eDur = errorIfNotPositiveInt("Trajanje (min)", fDuration);
    if (eDur) errors.push(eDur);

    if (!fLocation?.trim()) errors.push("Lokacija je obavezna.");

    const eQ = errorIfNegativeInt("Broj pitanja", fNumberOfQuestions);
    if (eQ) errors.push(eQ);

    if (fSolutionUrl && !/^https?:\/\/.+/i.test(fSolutionUrl.trim())) {
      errors.push("Link ka rješenju mora biti validan URL (počinje sa http/https).");
    }

    if (errors.length) {
      showAlert("Greška", errors.join("\n"));
      return false;
    }
    return true;
  };

  const formatDateForDB = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = "00";
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const submitCreate = async () => {
    if (!validateCreate()) return;
    setSubmitting(true);
    try {
      const payload = {
        IdScience: Number(fScienceId),
        Year: Number(fYear),
        IdMentor: Number(fMentorId),
        StartDate: formatDateForDB(fStartDate),
        Duration: Number(fDuration),
        Location: fLocation.trim(),
        NumberOfQuestions: fNumberOfQuestions !== "" ? Number(fNumberOfQuestions) : undefined,
        SolutionUrl: fSolutionUrl ? fSolutionUrl.trim() : undefined,
      };

      await apiClient.post("/science-competitions", payload, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      setFormModalOpen(false);
      resetForm();

      await debounceFetch(fetchList);

      showAlert("Uspjeh", "Naučno takmičenje uspješno kreirano.");
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Kreiranje nije uspjelo.";
      showAlert("Greška", reason);
    } finally {
      setSubmitting(false);
    }
  };

  const validateEdit = () => {
    const errors = [];

    if (!fStartDate || !(fStartDate instanceof Date) || isNaN(fStartDate.getTime())) {
      errors.push("Datum početka je obavezan.");
    }

    if (!fScienceId) {
      errors.push("Nauka se mora odabrati.");
    } else {
      const eSci = errorIfNotPositiveInt("Nauka", fScienceId);
      if (eSci) errors.push(eSci);
    }

    if (!fMentorId) {
      errors.push("Mentor se mora odabrati.");
    } else {
      const eMent = errorIfNotPositiveInt("Mentor", fMentorId);
      if (eMent) errors.push(eMent);
    }

    const eYear = errorIfNotPositiveInt("Godina", fYear);
    if (eYear) errors.push(eYear);

    const eDur = errorIfNotPositiveInt("Trajanje (min)", fDuration);
    if (eDur) errors.push(eDur);

    if (!fLocation?.trim()) errors.push("Lokacija je obavezna.");

    const eQ = errorIfNegativeInt("Broj pitanja", fNumberOfQuestions);
    if (eQ) errors.push(eQ);

    if (errors.length) {
      showAlert("Greška", errors.join("\n"));
      return false;
    }
    return true;
  };

  const uploadSolutionFile = async (competitionId, file) => {
    try {
      setUploadingFile(true);
      const formData = new FormData();

      if (Platform.OS === "web") {
        formData.append("document", file);
      } else {
        formData.append("document", {
          uri: file.uri,
          type: file.mimeType || "application/pdf",
          name: file.name,
        });
      }

      await apiClient.post(`/science-competitions/${competitionId}/solution`, formData, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          "Content-Type": "multipart/form-data",
        },
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      showAlert("Greška", "Neuspješan upload fajla.");
      throw error;
    } finally {
      setUploadingFile(false);
    }
  };

  const submitEdit = async () => {
    if (!selected) return;
    if (!validateEdit()) return;
    setSubmitting(true);
    try {
      const payload = {
        IdScience: Number(fScienceId),
        Year: Number(fYear),
        IdMentor: Number(fMentorId),
        StartDate: formatDateForDB(fStartDate),
        Duration: Number(fDuration),
        Location: fLocation.trim(),
        NumberOfQuestions: fNumberOfQuestions !== "" ? Number(fNumberOfQuestions) : undefined,
      };

      await apiClient.put(`/science-competitions/${selected.IdScienceCompetition}`, payload, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      if (fSolutionFile) {
        await uploadSolutionFile(selected.IdScienceCompetition, fSolutionFile);
      }

      setFormModalOpen(false);
      setSelected(null);
      resetForm();

      await debounceFetch(fetchList);

      showAlert("Uspjeh", "Takmičenje je uspješno ažurirano.");
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Izmjena nije uspjela.";
      showAlert("Greška", reason);
    } finally {
      setSubmitting(false);
    }
  };

  const pickDocument = async () => {
    try {
      if (Platform.OS === "web") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf,.doc,.docx,.txt";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) setFSolutionFile(file);
        };
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          copyToCacheDirectory: true,
        });

        // NOTE: newer expo-document-picker uses result.assets
        if (result.type === "success") {
          setFSolutionFile(result);
        } else if (result.assets && result.assets[0]) {
          setFSolutionFile(result.assets[0]);
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
      showAlert("Greška", "Neuspješan izbor fajla.");
    }
  };

  const onCardPress = (item) => {
    setSelected(item);
    setActionModalOpen(true);
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => onCardPress(item)}>
      <View style={styles.iconCircle}>
        <Ionicons name="flask-outline" size={24} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.ScienceName}
        </Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="calendar-outline" size={14} color={primary} />
            <Text style={styles.metaText}>Godina: {item.Year}</Text>
          </View>
          {typeof item.NumberOfQuestions === "number" && (
            <View style={styles.metaPill}>
              <Ionicons name="help-circle-outline" size={14} color={primary} />
              <Text style={styles.metaText}>Pitanja: {item.NumberOfQuestions}</Text>
            </View>
          )}
          {item.SolutionUrl ? (
            <View style={styles.metaPill}>
              <Ionicons name="document-text-outline" size={14} color={primary} />
              <Text style={styles.metaText}>Rješenja</Text>
            </View>
          ) : null}
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

  const formatDateTimeLocal = (date) => {
    if (!date) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`;
  };

  const startAndroidDateTimePick = () => {
    setAndroidPickingTime(false);
    setShowDatePicker(true);
  };

  const onChangeAndroidDate = (event, pickedDate) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    const base = pickedDate || new Date();
    const current = fStartDate || new Date();
    const withDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), current.getHours(), current.getMinutes());
    setFStartDate(withDate);
    setShowDatePicker(false);
    setAndroidPickingTime(true);
  };

  const onChangeAndroidTime = (event, pickedTime) => {
    if (event.type === "dismissed") {
      setAndroidPickingTime(false);
      return;
    }
    const time = pickedTime || new Date();
    const current = fStartDate || new Date();
    const withTime = new Date(current.getFullYear(), current.getMonth(), current.getDate(), time.getHours(), time.getMinutes());
    setFStartDate(withTime);
    setAndroidPickingTime(false);
  };

  const renderDateInput = () => {
    if (Platform.OS === "web") {
      const toLocalInputValue = (date) => {
        if (!date) return "";
        const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 16);
      };
      return (
        <input
          type="datetime-local"
          value={toLocalInputValue(fStartDate)}
          onChange={(e) => {
            const val = e.target.value;
            if (val) setFStartDate(new Date(val));
            else setFStartDate(null);
          }}
          style={styles.webDateInput}
        />
      );
    }

    if (Platform.OS === "android") {
      return (
        <>
          <TouchableOpacity style={styles.dateDisplay} onPress={startAndroidDateTimePick}>
            <Ionicons name="calendar-outline" size={18} color={primary} />
            <Text style={styles.dateDisplayText}>
              {fStartDate ? formatDateTimeLocal(fStartDate) : "Odaberite datum i vrijeme"}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker value={fStartDate || new Date()} mode="date" display="calendar" onChange={onChangeAndroidDate} />
          )}

          {androidPickingTime && (
            <DateTimePicker value={fStartDate || new Date()} mode="time" display="clock" onChange={onChangeAndroidTime} />
          )}
        </>
      );
    }

    return (
      <>
        <TouchableOpacity style={styles.dateDisplay} onPress={() => setShowDatePicker((s) => !s)}>
          <Ionicons name="calendar-outline" size={18} color={primary} />
          <Text style={styles.dateDisplayText}>
            {fStartDate ? formatDateTimeLocal(fStartDate) : "Odaberite datum i vrijeme"}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={fStartDate || new Date()}
            mode="datetime"
            display="inline"
            onChange={(event, date) => {
              if (date) setFStartDate(date);
            }}
          />
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upravljanje naučnim takmičenjima</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="flask-outline" size={42} color={primary} />
          <Text style={styles.emptyText}>Nema takmičenja.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.IdScienceCompetition)}
          renderItem={renderCard}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>

      <Modal visible={actionModalOpen} transparent animationType="fade" onRequestClose={() => setActionModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActionModalOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Takmičenje</Text>
            <Text style={styles.modalSubtitle}>
              {selected?.ScienceName} • {selected?.Year}
            </Text>

            <View style={styles.roleButtonsRow}>
              <TouchableOpacity
                style={[styles.roleButton, submitting && styles.disabled]}
                disabled={submitting}
                onPress={() => {
                  setActionModalOpen(false);
                  setTimeout(() => openEdit(selected), 50);
                }}
              >
                <Text style={styles.roleButtonLabel}>UREDI</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, submitting && styles.disabled]}
                disabled={submitting}
                onPress={() => {
                  setActionModalOpen(false);
                  setTimeout(() => confirmDelete(selected), 50);
                }}
              >
                <Text style={styles.roleButtonLabel}>OBRIŠI</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setActionModalOpen(false)}>
              <Text style={styles.cancelLabel}>OTKAŽI</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={formModalOpen} transparent animationType="fade" onRequestClose={() => setFormModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !submitting && setFormModalOpen(false)}>
          <Pressable style={styles.formModalCard}>
            <Text style={styles.modalTitle}>{formMode === "create" ? "Novo naučno takmičenje" : "Uredi takmičenje"}</Text>
            <Text style={styles.modalSubtitle}>
              {formMode === "create" ? "Popunite obavezna polja." : `${selected?.ScienceName || ""} • ${selected?.Year || ""}`}
            </Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
              <DropdownSelect
                label="Nauka*"
                items={sciences}
                value={fScienceId}
                onChange={setFScienceId}
                placeholder="Odaberite nauku..."
                loading={loadingSciences}
                iconName="flask-outline"
              />

              <DropdownSelect
                label="Mentor*"
                items={mentors}
                value={fMentorId}
                onChange={setFMentorId}
                placeholder="Odaberite mentora..."
                loading={loadingMentors}
                searchable
                onSearchChange={(q) => {
                  setMentorsQuery(q);
                  if (mentorsTimerRef.current) clearTimeout(mentorsTimerRef.current);
                  mentorsTimerRef.current = setTimeout(() => loadMentors(q), 250);
                }}
                iconName="person-outline"
              />

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Datum početka*</Text>
                <View style={styles.inputFieldContainer}>{renderDateInput()}</View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Trajanje (min)*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="time-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={fDuration}
                    onChangeText={setFDuration}
                    placeholder="npr. 90"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Lokacija*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="location-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput style={styles.inputIconText} value={fLocation} onChangeText={setFLocation} placeholder="npr. Amfiteatar A1" />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Godina*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="calendar-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={fYear}
                    onChangeText={(val) => {
                      setFYearTouched(true);
                      setFYear(val);
                    }}
                    placeholder="npr. 2025"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Broj pitanja</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="help-circle-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={fNumberOfQuestions}
                    onChangeText={setFNumberOfQuestions}
                    placeholder="npr. 10"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Fajl za rješenje</Text>

                {formMode === "edit" && fSolutionUrl && !fSolutionFile && (
                  <View style={styles.existingFileContainer}>
                    <Ionicons name="document-text" size={16} color={primary} />
                    <Text style={styles.existingFileText}>Postojeći fajl dostupan</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.filePickerButton} onPress={pickDocument} disabled={submitting || uploadingFile}>
                  <Ionicons name="cloud-upload-outline" size={18} color={primary} style={styles.inputIcon} />
                  <Text style={styles.filePickerButtonText}>
                    {fSolutionFile
                      ? fSolutionFile.name || "Fajl odabran"
                      : formMode === "edit" && fSolutionUrl
                        ? "Promijeni fajl"
                        : "Odaberi fajl"}
                  </Text>
                </TouchableOpacity>

                {fSolutionFile && (
                  <TouchableOpacity style={styles.removeFileButton} onPress={() => setFSolutionFile(null)}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                    <Text style={styles.removeFileText}>Ukloni</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.formButtonsRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && styles.disabled]}
                  disabled={submitting}
                  onPress={formMode === "create" ? submitCreate : submitEdit}
                >
                  <Text style={styles.primaryBtnLabel}>{formMode === "create" ? "KREIRAJ" : "SAČUVAJ"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.cancelButton} disabled={submitting} onPress={() => setFormModalOpen(false)}>
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
    alignItems: "center",
    backgroundColor: "#fff",
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
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 6 },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  metaText: { fontSize: 12, color: primary, fontWeight: "600" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  denied: { marginTop: 10, fontSize: 16, color: "#999" },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { marginTop: 10, fontSize: 16, color: "#666" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 90,
    backgroundColor: orange,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  formModalCard: {
    position: "relative",
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 64,
    paddingLeft: 16,
    marginHorizontal: 20,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  dropdownModalCard: {
    position: "relative",
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 64,
    paddingLeft: 16,
    marginHorizontal: 20,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  modalCard: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 24,
    paddingRight: 20,
    paddingBottom: 56,
    paddingLeft: 20,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  modalTitle: { fontSize: 20, fontWeight: "700", color: "#222", marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: "#666", marginBottom: 16 },

  roleButtonsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14 },
  roleButton: {
    flexGrow: 1,
    minWidth: 130,
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
  },
  roleButtonLabel: { fontSize: 15, fontWeight: "700", color: primary, letterSpacing: 0.3 },

  cancelButton: { position: "absolute", right: 16, bottom: 12, paddingHorizontal: 6, paddingVertical: 4 },
  cancelLabel: { color: primary, fontSize: 14, fontWeight: "600" },

  disabled: { opacity: 0.5 },

  inputRow: { marginBottom: 12 },
  inputLabel: { fontSize: 13, color: "#555", marginBottom: 6 },
  inputFieldContainer: { width: "100%", marginRight: 12 },

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

  formButtonsRow: { marginTop: 8, flexDirection: "row", justifyContent: "center" },
  primaryBtn: {
    backgroundColor: primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  primaryBtnLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },

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
    marginRight: 12,
  },

  selectField: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectFieldText: { fontSize: 15, color: "#333", flex: 1 },

  searchBar: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#333" },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemSelected: { backgroundColor: "#EAF3FF" },
  dropdownItemLabel: { fontSize: 15, color: "#333", fontWeight: "600" },
  dropdownItemSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },

  // File picker styles (you referenced these in the UI; keep if they exist in your original project)
  existingFileContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  existingFileText: { color: "#555", fontSize: 13, fontWeight: "600" },

  filePickerButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  filePickerButtonText: { flex: 1, fontSize: 15, color: "#333" },

  removeFileButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  removeFileText: { fontSize: 13, color: "#666", fontWeight: "600" },
});

export default ScienceCompetitionsScreen;