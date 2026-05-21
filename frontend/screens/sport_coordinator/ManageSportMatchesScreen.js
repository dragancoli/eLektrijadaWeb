// screens/ManageSportMatchesScreen.js
import React, { useState, useEffect, useMemo } from "react";
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
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const primary = "#10345bff";
const orange = "#fa8d10ff";

const NONE = "__none__";

const showAlert = (title, message) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message || ""}`);
  else Alert.alert(title, message);
};

/**
 * DropdownSelect (kopirano/usklađeno iz ScienceCompetitionsScreen)
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
  const [localQuery, setLocalQuery] = useState("");

  const selectedItem = useMemo(
    () => items.find((i) => String(i.value) === String(value)),
    [items, value]
  );

  useEffect(() => {
    if (! modalOpen) setLocalQuery("");
  }, [modalOpen]);

  const filteredItems = useMemo(() => {
    const q = (localQuery || "").trim().toLowerCase();
    if (! q) return items;
    return items. filter((i) => {
      const hay = [i.label, i.subtitle].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, localQuery]);

  return (
    <View style={styles.inputRow}>
      {!! label && <Text style={styles. inputLabel}>{label}</Text>}
      <TouchableOpacity style={styles.selectField} activeOpacity={0.7} onPress={() => setModalOpen(true)}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {iconName ?  <Ionicons name={iconName} size={18} color={primary} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.selectFieldText, ! selectedItem && { color: "#999" }]} numberOfLines={1}>
            {selectedItem ?  selectedItem.label :  placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#999" />
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles. dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>{label || "Odabir"}</Text>

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
                <Text style={{ marginTop: 8, color: "#666" }}>Nema rezultata. </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                {filteredItems.map((it) => {
                  const isSelected = String(it.value) === String(value);
                  return (
                    <TouchableOpacity
                      key={String(it.value)}
                      style={[styles.dropdownItem, isSelected && styles. dropdownItemSelected]}
                      onPress={() => {
                        onChange(String(it.value));
                        setModalOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemLabel}>{it.label}</Text>
                      {!! it.subtitle && <Text style={styles. dropdownItemSubtitle}>{it. subtitle}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.cancelButtonAbsolute} onPress={() => setModalOpen(false)}>
              <Text style={styles. cancelLabelAbsolute}>OTKAŽI</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const ManageSportMatchesScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Data state
  const [matches, setMatches] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [selectedCompetition, setSelectedCompetition] = useState("all");

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    IdTeam1:  NONE,
    IdTeam2: NONE,
    IdSportCompetition:  NONE,
    Status: "Zakazano",
    Stage:  NONE,
    ResultTeam1: "",
    ResultTeam2: "",
    Duration: "",
    Location: "",
  });

  // DateTime picker state (kao u ScienceCompetitionsScreen)
  const [fStartDate, setFStartDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidPickingTime, setAndroidPickingTime] = useState(false);

  const stageOptions = [
    { label: "— Odaberite fazu —", value:  NONE },
    { label: "Grupna faza", value:  "Grupna faza" },
    { label: "Osminafinala", value: "Osminafinala" },
    { label: "Četvrtfinale", value: "Četvrtfinale" },
    { label: "Polufinale", value: "Polufinale" },
    { label: "Finale", value: "Finale" },
    { label: "Ostalo", value: "Ostalo" },
  ];

  const statusOptions = [
    { label: "Zakazano", value: "Zakazano" },
    { label: "U toku", value: "U toku" },
    { label:  "Završeno", value: "Završeno" },
    { label: "Otkazano", value: "Otkazano" },
  ];

  useEffect(() => {
    loadCompetitions();
    loadTeams();
    loadMatches();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCompetitions(), loadTeams(), loadMatches()]);
    setRefreshing(false);
  };

  const loadCompetitions = async () => {
    try {
      const res = await apiClient.get("/sports/competitions", {
        headers: { Authorization: `Bearer ${user?. token}` },
      });
      setCompetitions(res.data || []);
    } catch (error) {
      console.error("Greška pri učitavanju takmičenja:", error);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await apiClient.get("/sports/teams", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setTeams(res.data || []);
    } catch (error) {
      console.error("Greška pri učitavanju timova:", error);
    }
  };

  const loadMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await apiClient. get("/matches", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setMatches(res.data || []);
    } catch (error) {
      console. error("Greška pri učitavanju mečeva:", error);
      Alert.alert("Greška", "Nije moguće učitati mečeve.");
    } finally {
      setLoadingMatches(false);
    }
  };

  // Helper funkcije za datum - format za backend ostaje isti
  const formatDateForDB = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date. getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = "00";
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatDateTimeLocal = (date) => {
    if (! date) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date. getDate())}. ${pad(date. getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedCompetitionObj = useMemo(() => {
    if (selectedCompetition === "all") return null;
    return competitions.find((c) => String(c.IdSportCompetition) === String(selectedCompetition)) || null;
  }, [competitions, selectedCompetition]);

  const filteredMatches = useMemo(() => {
    if (! selectedCompetitionObj) return matches;
    return matches.filter(
      (m) => m.SportName === selectedCompetitionObj.SportName && String(m.Year) === String(selectedCompetitionObj. Year)
    );
  }, [matches, selectedCompetitionObj]);

  const availableTeams = useMemo(() => {
    if (!formData.IdSportCompetition || formData.IdSportCompetition === NONE) return [];
    const comp = competitions.find((c) => String(c.IdSportCompetition) === String(formData.IdSportCompetition));
    if (!comp) return [];
    return teams.filter((t) => t.SportName === comp.SportName && String(t.Year) === String(comp.Year));
  }, [teams, competitions, formData. IdSportCompetition]);

  // MAPPED ITEMS for DropdownSelect
  const competitionItemsFilter = useMemo(() => {
    return [
      { label: "Sva takmičenja", value: "all" },
      ... competitions.map((c) => ({
        label: `${c.SportName} ${c.Year}`,
        value: String(c.IdSportCompetition),
      })),
    ];
  }, [competitions]);

  const competitionItemsForm = useMemo(() => {
    return [
      { label: "— Odaberite takmičenje —", value: NONE },
      ... competitions.map((c) => ({
        label: `${c.SportName} ${c.Year}`,
        value: String(c.IdSportCompetition),
      })),
    ];
  }, [competitions]);

  const team1Items = useMemo(() => {
    if (formData.IdSportCompetition === NONE) return [{ label: "— Odaberite tim —", value:  NONE }];
    const base = availableTeams.map((t) => ({ label: t.TeamName, value: String(t.IdTeam) }));
    return [{ label: "— Odaberite tim —", value:  NONE }, ...base];
  }, [availableTeams, formData.IdSportCompetition]);

  const team2Items = useMemo(() => {
    if (formData. IdSportCompetition === NONE) return [{ label:  "— Odaberite tim —", value: NONE }];
    const base = availableTeams
      .filter((t) => String(t.IdTeam) !== String(formData.IdTeam1))
      .map((t) => ({ label: t.TeamName, value: String(t.IdTeam) }));
    return [{ label: "— Odaberite tim —", value: NONE }, ...base];
  }, [availableTeams, formData.IdSportCompetition, formData.IdTeam1]);

  const stageItems = useMemo(() => stageOptions. map((s) => ({ label: s. label, value: String(s.value) })), []);
  const statusItems = useMemo(
    () => statusOptions.map((s) => ({ label: s.label, value: String(s. value) })),
    []
  );

  const handleAddMatch = () => {
    setModalMode("add");
    const now = new Date();
    setFStartDate(now);
    setFormData({
      IdTeam1: NONE,
      IdTeam2: NONE,
      IdSportCompetition: selectedCompetition !== "all" ? String(selectedCompetition) : NONE,
      Status: "Zakazano",
      Stage:  NONE,
      ResultTeam1: "",
      ResultTeam2: "",
      Duration: "",
      Location: "",
    });
    setSelectedMatch(null);
    setShowDatePicker(false);
    setAndroidPickingTime(false);
    setModalVisible(true);
  };

  const handleEditMatch = async (match) => {
    setModalMode("edit");
    setSelectedMatch(match);

    try {
      const res = await apiClient. get(`/matches/${match.IdMatch}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const fullMatch = res.data;

      if (fullMatch.StartDate) {
        const date = new Date(fullMatch.StartDate);
        setFStartDate(date);
      } else {
        setFStartDate(null);
      }

      setFormData({
        IdTeam1: fullMatch.IdTeam1 ?  String(fullMatch.IdTeam1) : NONE,
        IdTeam2: fullMatch.IdTeam2 ? String(fullMatch.IdTeam2) : NONE,
        IdSportCompetition: fullMatch. IdSportCompetition ? String(fullMatch.IdSportCompetition) : NONE,
        Status: fullMatch. Status || "Zakazano",
        Stage:  fullMatch.Stage ?  String(fullMatch. Stage) : NONE,
        ResultTeam1: fullMatch.ResultTeam1 !== null ? String(fullMatch.ResultTeam1) : "",
        ResultTeam2: fullMatch.ResultTeam2 !== null ? String(fullMatch.ResultTeam2) : "",
        Duration: fullMatch. Duration ?  String(fullMatch.Duration) : "",
        Location: fullMatch. Location || "",
      });
      setShowDatePicker(false);
      setAndroidPickingTime(false);
      setModalVisible(true);
    } catch (error) {
      console.error("Greška pri učitavanju detalja meča:", error);
      showAlert("Greška", "Nije moguće učitati detalje meča.");
    }
  };

  const handleDeleteMatch = (match) => {
    const confirmAction = async () => {
      try {
        await apiClient.delete(`/matches/${match.IdMatch}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        showAlert("Uspjeh", "Meč je uspješno obrisan.");
        loadMatches();
      } catch (error) {
        console.error("Greška pri brisanju meča:", error);
        showAlert("Greška", error.response?.data?.message || "Nije moguće obrisati meč.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Da li ste sigurni da želite obrisati meč "${match.Team1Name} vs ${match.Team2Name}"?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        "Potvrda",
        `Da li ste sigurni da želite obrisati meč "${match.Team1Name} vs ${match.Team2Name}"?`,
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

  const handleResultChange = (team, value) => {
    setFormData({
      ...formData,
      [`ResultTeam${team}`]: value,
    });
  };

  // Android date-time pick (isto kao u ScienceCompetitionsScreen)
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
    const withDate = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      current.getHours(),
      current.getMinutes()
    );
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
    const withTime = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    setFStartDate(withTime);
    setAndroidPickingTime(false);
  };

  // Renderovanje date input-a (kao u ScienceCompetitionsScreen)
  const renderDateInput = () => {
    if (Platform.OS === "web") {
      const toLocalInputValue = (date) => {
        if (!date) return "";
        const d = new Date(date. getTime() - date.getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 16);
      };
      return (
        <input
          type="datetime-local"
          value={toLocalInputValue(fStartDate)}
          onChange={(e) => {
            const val = e.target. value;
            if (val) {
              const d = new Date(val);
              setFStartDate(d);
            } else {
              setFStartDate(null);
            }
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
            <DateTimePicker
              value={fStartDate || new Date()}
              mode="date"
              display="calendar"
              onChange={onChangeAndroidDate}
            />
          )}

          {androidPickingTime && (
            <DateTimePicker
              value={fStartDate || new Date()}
              mode="time"
              display="clock"
              onChange={onChangeAndroidTime}
            />
          )}
        </>
      );
    }

    // iOS
    return (
      <>
        <TouchableOpacity style={styles.dateDisplay} onPress={() => setShowDatePicker((s) => !s)}>
          <Ionicons name="calendar-outline" size={18} color={primary} />
          <Text style={styles. dateDisplayText}>
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

  const saveMatch = async () => {
    if (
      !formData. IdSportCompetition ||
      formData.IdSportCompetition === NONE ||
      ! formData.IdTeam1 ||
      formData.IdTeam1 === NONE ||
      !formData.IdTeam2 ||
      formData. IdTeam2 === NONE
    ) {
      Alert.alert("Greška", "Takmičenje i oba tima su obavezni.");
      return;
    }
    if (formData.IdTeam1 === formData.IdTeam2) {
      Alert.alert("Greška", "Timovi ne mogu biti isti.");
      return;
    }
    if (! fStartDate || !(fStartDate instanceof Date) || isNaN(fStartDate.getTime())) {
      Alert.alert("Greška", "Datum početka je obavezan.");
      return;
    }
    if (!formData.Duration || ! formData.Location. trim()) {
      Alert.alert("Greška", "Trajanje i lokacija su obavezni.");
      return;
    }

    const hasResult1 = formData. ResultTeam1 !== "" && formData.ResultTeam1 !== null;
    const hasResult2 = formData.ResultTeam2 !== "" && formData.ResultTeam2 !== null;

    if (hasResult1 !== hasResult2) {
      Alert.alert("Greška", "Morate unijeti rezultat za oba tima ili ostaviti oba polja prazna.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        IdTeam1: Number(formData.IdTeam1),
        IdTeam2: Number(formData.IdTeam2),
        IdSportCompetition:  Number(formData.IdSportCompetition),
        Status: formData.Status,
        Stage: formData.Stage && formData.Stage !== NONE ? formData.Stage : null,
        ResultTeam1: formData.ResultTeam1 !== "" ?  Number(formData. ResultTeam1) : null,
        ResultTeam2: formData.ResultTeam2 !== "" ? Number(formData.ResultTeam2) : null,
        StartDate: formatDateForDB(fStartDate),
        Duration: Number(formData.Duration),
        Location: formData.Location,
      };

      if (modalMode === "add") {
        await apiClient.post("/matches", payload, {
          headers:  { Authorization: `Bearer ${user?.token}` },
        });
        Alert.alert("Uspjeh", "Meč je uspješno dodat.");
      } else {
        await apiClient.put(`/matches/${selectedMatch.IdMatch}`, payload, {
          headers: { Authorization:  `Bearer ${user?.token}` },
        });
        Alert.alert("Uspjeh", "Meč je uspješno ažuriran.");
      }
      setModalVisible(false);
      loadMatches();
    } catch (error) {
      console.error("Greška pri čuvanju meča:", error);
      Alert.alert("Greška", error.response?.data?. message || "Nije moguće sačuvati meč.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Zakazano": 
        return "#FFB800";
      case "U toku": 
        return primary;
      case "Završeno": 
        return "#34C759";
      case "Otkazano":
        return "#FF3B30";
      default:
        return "#999";
    }
  };

  const renderMatchCard = (match) => (
    <View key={match.IdMatch} style={styles. matchCard}>
      <View style={styles.matchHeader}>
        <View style={styles.matchTitleRow}>
          <Ionicons name="football" size={24} color={primary} />
          <Text style={styles.matchSport}>
            {match.SportName} {match.Year}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(match.Status) }]}>
          <Text style={styles.statusText}>{match. Status}</Text>
        </View>
      </View>

      <View style={styles.matchTeams}>
        <View style={styles.team}>
          <Text style={styles.teamName}>{match.Team1Name}</Text>
          {match.ResultTeam1 !== null && <Text style={styles. teamScore}>{match.ResultTeam1}</Text>}
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.team}>
          <Text style={styles.teamName}>{match.Team2Name}</Text>
          {match. ResultTeam2 !== null && <Text style={styles.teamScore}>{match. ResultTeam2}</Text>}
        </View>
      </View>

      <View style={styles.matchInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{formatDate(match.StartDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles. infoText}>{match.Location}</Text>
        </View>
        {match.Stage ?  (
          <View style={styles.infoRow}>
            <Ionicons name="trophy-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{match.Stage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.matchActions}>
        <TouchableOpacity onPress={() => handleEditMatch(match)} style={styles.actionButton}>
          <Ionicons name="create-outline" size={22} color={primary} />
          <Text style={styles.actionButtonText}>Izmijeni</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteMatch(match)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          <Text style={[styles.actionButtonText, { color: "#FF3B30" }]}>Obriši</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Filter */}
      <View style={styles.filterContainer}>
        <DropdownSelect
          label="Filtriraj po takmičenju:"
          iconName="trophy-outline"
          items={competitionItemsFilter}
          value={selectedCompetition}
          onChange={(val) => setSelectedCompetition(String(val))}
          placeholder="Sva takmičenja"
          searchable
        />
      </View>

      {/* Matches List */}
      <ScrollView 
        style={styles. content} 
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
        {loadingMatches ?  (
          <ActivityIndicator size="large" color={primary} style={{ marginTop: 50 }} />
        ) : filteredMatches.length === 0 ?  (
          <View style={styles.emptyState}>
            <Ionicons name="football-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nema mečeva</Text>
          </View>
        ) : (
          filteredMatches.map(renderMatchCard)
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddMatch} activeOpacity={0.8}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles. modalTitle}>{modalMode === "add" ? "Dodaj meč" : "Izmijeni meč"}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Competition */}
              <DropdownSelect
                label="Takmičenje *"
                iconName="trophy-outline"
                items={competitionItemsForm}
                value={formData.IdSportCompetition}
                onChange={(val) =>
                  setFormData({
                    ...formData,
                    IdSportCompetition: String(val),
                    IdTeam1: NONE,
                    IdTeam2: NONE,
                  })
                }
                placeholder="— Odaberite takmičenje —"
                searchable
              />

              {/* Team 1 */}
              <DropdownSelect
                label="Tim 1 *"
                iconName="people-outline"
                items={team1Items}
                value={formData.IdTeam1}
                onChange={(val) => setFormData({ ... formData, IdTeam1: String(val) })}
                placeholder="— Odaberite tim —"
                searchable
              />
              {formData. IdSportCompetition !== NONE && availableTeams.length === 0 && (
                <Text style={styles.warningText}>Nema timova za odabrano takmičenje</Text>
              )}

              {/* Team 2 */}
              <DropdownSelect
                label="Tim 2 *"
                iconName="people-outline"
                items={team2Items}
                value={formData.IdTeam2}
                onChange={(val) => setFormData({ ...formData, IdTeam2: String(val) })}
                placeholder="— Odaberite tim —"
                searchable
              />

              {/* Status */}
              <DropdownSelect
                label="Status *"
                iconName="flag-outline"
                items={statusItems}
                value={formData.Status}
                onChange={(val) => setFormData({ ...formData, Status: String(val) })}
                placeholder="Odaberite status..."
              />

              {/* Stage */}
              <DropdownSelect
                label="Faza"
                iconName="medal-outline"
                items={stageItems}
                value={formData.Stage}
                onChange={(val) => setFormData({ ...formData, Stage: String(val) })}
                placeholder="— Odaberite fazu —"
              />

              {/* Results */}
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Rezultat Tim 1</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Rezultat"
                    value={formData.ResultTeam1}
                    onChangeText={(val) => handleResultChange(1, val)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles. label}>Rezultat Tim 2</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Rezultat"
                    value={formData.ResultTeam2}
                    onChangeText={(val) => handleResultChange(2, val)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              {(formData.ResultTeam1 !== "" || formData.ResultTeam2 !== "") && (
                <Text style={styles.hintText}>Oba rezultata moraju biti unesena ili oba prazna</Text>
              )}

              {/* Date & Time - isti stil kao ScienceCompetitionsScreen */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Datum i vrijeme *</Text>
                <View style={styles.inputFieldContainer}>{renderDateInput()}</View>
              </View>

              {/* Duration */}
              <View style={styles.inputRow}>
                <Text style={styles. inputLabel}>Trajanje (minuti) *</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="time-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    placeholder="npr. 90"
                    value={formData.Duration}
                    onChangeText={(val) => setFormData({ ...formData, Duration: val })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Location */}
              <View style={styles. inputRow}>
                <Text style={styles.inputLabel}>Lokacija *</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="location-outline" size={18} color={primary} style={styles. inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    placeholder="npr. Stadion Gradski"
                    value={formData.Location}
                    onChangeText={(val) => setFormData({ ... formData, Location:  val })}
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles. modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Otkaži</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={saveMatch} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles. saveButtonText}>Sačuvaj</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f5f5f5" },

  filterContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },

  content: { flex: 1, paddingHorizontal: 15, paddingTop: 15 },

  matchCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding:  15,
    marginBottom: 15,
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#e0e0e0",
  },
  matchHeader: { flexDirection: "row", justifyContent:  "space-between", alignItems: "center", marginBottom: 15 },
  matchTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  matchSport: { fontSize: 14, fontWeight: "600", color: "#666" },
  statusBadge: { paddingHorizontal:  12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  matchTeams: {
    flexDirection:  "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  team: { flex: 1, alignItems: "center" },
  teamName: { fontSize: 16, fontWeight:  "600", color: "#333", textAlign: "center", marginBottom: 4 },
  teamScore: { fontSize:  24, fontWeight: "bold", color: primary },
  vsText:  { fontSize: 14, fontWeight: "600", color: "#999", marginHorizontal: 10 },

  matchInfo: { gap: 8, marginBottom: 15 },
  infoRow: { flexDirection:  "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, color: "#666" },

  matchActions: { flexDirection: "row", gap: 10, paddingTop: 10, borderTopColor: "#f0f0f0", borderTopWidth: 1 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems:  "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor:  "#f9f9f9",
  },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: primary },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize:  16, color: "#999", marginTop: 15 },

  fab: {
    position: "absolute",
    bottom: 90,
    right:  20,
    backgroundColor: orange,
    width: 60,
    height:  60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems:  "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation:  8,
  },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalScrollContent: { justifyContent: "center", alignItems: "center", paddingVertical:  40 },
  modalContent: { backgroundColor:  "#fff", borderRadius:  20, padding:  20, width: "90%", maxWidth: 500 },
  modalHeader: { flexDirection:  "row", justifyContent: "space-between", alignItems:  "center", marginBottom: 20 },
  modalTitle:  { fontSize: 20, fontWeight: "bold", color: "#333" },

  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8, marginTop: 10 },

  input: {
    height: 50,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },

  warningText: { fontSize: 12, color: "#FF3B30", marginBottom: 10, marginTop: -5 },
  row: { flexDirection:  "row", gap: 10 },
  halfWidth: { flex: 1 },
  hintText: { fontSize: 12, color: "#666", marginTop: -5, marginBottom: 10, fontStyle: "italic" },

  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: "#f0f0f0", alignItems: "center" },
  cancelButtonText: { fontSize: 16, fontWeight: "600", color: "#666" },
  saveButton: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: primary, alignItems: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },

  // Shared dropdown styles (iz ScienceCompetitionsScreen)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dropdownModalCard: {
    position: "relative",
    width: "100%",
    maxWidth: 520,
    backgroundColor:  "#fff",
    borderRadius: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 64,
    paddingLeft: 16,
    marginHorizontal: 20,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation:  6,
  },
  dropdownModalTitle: { fontSize: 20, fontWeight: "700", color: "#222", marginBottom: 10 },

  // Inputs (isti stil kao ScienceCompetitionsScreen)
  inputRow: { marginBottom: 12 },
  inputLabel: { fontSize:  13, color: "#555", marginBottom: 6 },
  inputFieldContainer: { width: "100%" },

  inputIconField:  {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal:  12,
    flexDirection: "row",
    alignItems: "center",
  },
  inputIcon: { marginRight:  8 },
  inputIconText: { flex: 1, fontSize: 15, color: "#333" },

  // Date (isti stil kao ScienceCompetitionsScreen)
  dateDisplay: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal:  12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateDisplayText: { fontSize: 15, color: "#333", flex: 1 },
  webDateInput: {
    height: 44,
    borderRadius: 10,
    borderWidth:  1,
    borderColor: "#e0e0e0",
    backgroundColor:  "#f9f9f9",
    padding: "0 12px",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
  },

  // Select field (closed)
  selectField:  {
    height:  44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    flexDirection:  "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectFieldText: { fontSize: 15, color: "#333", flex: 1 },

  // Dropdown list
  searchBar: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal:  12,
    flexDirection: "row",
    alignItems:  "center",
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#333" },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  dropdownItemSelected: { backgroundColor: "#EAF3FF" },
  dropdownItemLabel: { fontSize: 15, color: "#333", fontWeight: "600" },
  dropdownItemSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },

  cancelButtonAbsolute: { position: "absolute", right: 16, bottom: 12, paddingHorizontal:  6, paddingVertical: 4 },
  cancelLabelAbsolute:  { color: primary, fontSize: 14, fontWeight: "600" },
});

export default ManageSportMatchesScreen;