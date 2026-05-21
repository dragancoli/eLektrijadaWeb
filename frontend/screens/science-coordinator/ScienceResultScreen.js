import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const primary = "#10345bff";
const orange = "#fa8d10ff";

const showAlert = (title, message) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message || ""}`);
  else Alert.alert(title, message);
};

// Reusable DropdownSelect (isti UX kao na drugim ekranima)
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

const ScienceResultsScreen = () => {
  const { user } = useAuth();
  const canAccess = user?.IdUserType === 4 || user?.IdUserType === 1;

  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");

  const [resultsLoading, setResultsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Expand i edit state
  const [expandedUserId, setExpandedUserId] = useState(null);
  // edits: { [userId]: { [questionNumber]: stringScore } }
  const [edits, setEdits] = useState({});
  // new row: { [userId]: { question: string, score: string } }
  const [newRow, setNewRow] = useState({});
  const [savingUser, setSavingUser] = useState(false);

  // Dodatni modal za dodavanje rezultata bilo kojem učesniku (opciono zadržano)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersForCompetition, setUsersForCompetition] = useState([]);
  const [newUserId, setNewUserId] = useState("");
  const [newQuestionNumber, setNewQuestionNumber] = useState("");
  const [newScore, setNewScore] = useState("");

  useEffect(() => {
    if (!canAccess) return;
    loadCompetitions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    if (selectedCompetitionId) await loadResults(selectedCompetitionId);
    setRefreshing(false);
  };

  const loadCompetitions = async () => {
    try {
      setLoadingCompetitions(true);
      const res = await apiClient.get("/science-competitions", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const mapped = (res.data || []).map((c) => ({
        label: `${c.ScienceName} • ${c.Year}`,
        value: String(c.IdScienceCompetition),
        subtitle: c.SolutionUrl ? "Ima rješenja" : "",
      }));
      setCompetitions(mapped);
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje takmičenja.");
    } finally {
      setLoadingCompetitions(false);
    }
  };

  const loadResults = async (competitionId) => {
    if (!competitionId) return;
    try {
      setResultsLoading(true);
      const res = await apiClient.get(`/science-results/${competitionId}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setResults(res.data || []);
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje rezultata.");
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompetitionId) {
      loadResults(selectedCompetitionId);
      // reset ekspand/edit state
      setExpandedUserId(null);
      setEdits({});
      setNewRow({});
      // reset add modal state
      setAddModalOpen(false);
      setNewUserId("");
      setNewQuestionNumber("");
      setNewScore("");
      setUsersForCompetition([]);
    } else {
      setResults([]);
    }
  }, [selectedCompetitionId]);

  const originalByUser = useMemo(() => {
    // { userId: { [questionNumber]: score } }
    const map = {};
    for (const r of results) {
      const uid = String(r.IdUser);
      if (!map[uid]) map[uid] = {};
      map[uid][String(r.QuestionNumber)] = Number(r.Score);
    }
    return map;
  }, [results]);

  // Grupisanje i sortiranje po totalu desc, TOTAL računa i eventualne nerealizovane promjene i novi unos
  const groupedByUser = useMemo(() => {
    const grouped = new Map();
    for (const r of results) {
      const uid = String(r.IdUser);
      if (!grouped.has(uid)) {
        grouped.set(uid, {
          IdUser: r.IdUser,
          Name: r.Name,
          Lastname: r.Lastname,
          FacultyName: r.FacultyName,
          items: [],
        });
      }
      grouped.get(uid).items.push({ QuestionNumber: r.QuestionNumber, Score: r.Score });
    }

    const arr = Array.from(grouped.values()).map((u) => {
      const uid = String(u.IdUser);
      const userEdits = edits[uid] || {};
      let total = 0;
      // postojeća pitanja
      for (const row of u.items) {
        const qKey = String(row.QuestionNumber);
        const edited = userEdits[qKey];
        const used = edited !== undefined && edited !== "" ? Number(edited) : Number(row.Score);
        total += Number.isFinite(used) ? used : 0;
      }
      // potencijalno novo pitanje (ako je ekspanzija nad ovim korisnikom)
      const pendingNew = newRow[uid];
      if (pendingNew && Number.isInteger(Number(pendingNew.question)) && Number.isFinite(Number(pendingNew.score))) {
        total += Number(pendingNew.score);
      }
      return { ...u, total };
    });

    return arr.sort((a, b) => b.total - a.total);
  }, [results, edits, newRow]);

  const toggleExpand = (uid) => {
    setExpandedUserId((cur) => (cur === uid ? null : uid));
  };

  const setEditScore = (uid, qNum, val) => {
    setEdits((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [String(qNum)]: val },
    }));
  };

  const setNewRowForUser = (uid, field, val) => {
    setNewRow((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [field]: val },
    }));
  };

  const saveUserChanges = async (uid) => {
    const compId = selectedCompetitionId;
    if (!compId) {
      showAlert("Greška", "Prvo odaberite takmičenje.");
      return;
    }
    const uidStr = String(uid);
    const userEdits = edits[uidStr] || {};
    const originals = originalByUser[uidStr] || {};
    const changes = [];

    // Pripremi PUT-ove (samo ako se vrijednost promijenila i validna je)
    for (const qKey of Object.keys(userEdits)) {
      const newValStr = userEdits[qKey];
      if (newValStr === undefined || newValStr === "") continue;
      const newVal = Number(newValStr);
      if (!Number.isFinite(newVal)) {
        showAlert("Greška", `Bodovi za pitanje #${qKey} moraju biti broj.`);
        return;
      }
      const orig = originals[qKey];
      if (orig === undefined || Number(orig) !== newVal) {
        changes.push({
          type: "put",
          url: `/science-results/${compId}/${uid}/${qKey}`,
          body: { Score: newVal },
        });
      }
    }

    // Pripremi POST za novo pitanje (ako uneseno)
    const pendingNew = newRow[uidStr];
    if (pendingNew) {
      const qn = Number(pendingNew.question);
      const sc = Number(pendingNew.score);
      if (pendingNew.question || pendingNew.score) {
        if (!Number.isInteger(qn) || qn <= 0) {
          showAlert("Greška", "Broj novog pitanja mora biti pozitivan cijeli broj.");
          return;
        }
        if (!Number.isFinite(sc)) {
          showAlert("Greška", "Bodovi za novo pitanje moraju biti broj.");
          return;
        }
        changes.push({
          type: "post",
          url: `/science-results/${compId}`,
          body: { IdUser: Number(uid), QuestionNumber: qn, Score: sc },
        });
      }
    }

    if (changes.length === 0) {
      showAlert("Info", "Nema promjena za čuvanje.");
      return;
    }

    setSavingUser(true);
    try {
      // izvrši sekvencijalno radi jednostavnijeg error handlinga
      for (const op of changes) {
        if (op.type === "put") {
          await apiClient.put(op.url, op.body, { headers: { Authorization: `Bearer ${user?.token}` } });
        } else {
          await apiClient.post(op.url, op.body, { headers: { Authorization: `Bearer ${user?.token}` } });
        }
      }
      await loadResults(compId);
      // očisti lokalne promjene za korisnika
      setEdits((prev) => {
        const clone = { ...prev };
        delete clone[uidStr];
        return clone;
      });
      setNewRow((prev) => {
        const clone = { ...prev };
        delete clone[uidStr];
        return clone;
      });
      showAlert("Uspjeh", "Izmjene su sačuvane.");
    } catch (e) {
      showAlert("Greška", e?.response?.data?.message || "Greška pri čuvanju izmjena.");
    } finally {
      setSavingUser(false);
    }
  };

  // Opciono: dodavanje rezultata za korisnika koji nema nijedan zapis
  const loadUsersForCompetition = async () => {
    if (!selectedCompetitionId) {
      showAlert("Greška", "Prvo odaberite takmičenje.");
      return;
    }
    try {
      setUsersLoading(true);
      const res = await apiClient.get(`/science-results/users`, {
        headers: { Authorization: `Bearer ${user?.token}` },
        params: { competitionId: selectedCompetitionId },
      });
      const mapped = (res.data || []).map((u) => ({
        label: `${u.Name} ${u.Lastname}`,
        value: String(u.IdUser),
        subtitle: u.FacultyName || u.Email,
      }));
      setUsersForCompetition(mapped);
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje korisnika.");
      setUsersForCompetition([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAddResult = async () => {
    const compId = selectedCompetitionId;
    const uid = Number(newUserId);
    const qn = Number(newQuestionNumber);
    const sc = Number(newScore);

    const errs = [];
    if (!Number.isInteger(uid) || uid <= 0) errs.push("Korisnik se mora odabrati.");
    if (!Number.isInteger(qn) || qn <= 0) errs.push("Broj pitanja mora biti pozitivan cijeli broj.");
    if (!Number.isFinite(sc)) errs.push("Bodovi moraju biti broj.");
    if (errs.length) {
      showAlert("Greška", errs.join("\n"));
      return;
    }

    try {
      await apiClient.post(`/science-results/${compId}`, { IdUser: uid, QuestionNumber: qn, Score: sc }, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      showAlert("Uspjeh", "Rezultat uspješno dodat.");
      setAddModalOpen(false);
      setNewUserId("");
      setNewQuestionNumber("");
      setNewScore("");
      await loadResults(compId);
    } catch (e) {
      showAlert("Greška", e?.response?.data?.message || "Dodavanje nije uspjelo.");
    }
  };

  const renderUserCard = ({ item }) => {
    const uid = String(item.IdUser);
    const isExpanded = expandedUserId === uid;

    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-outline" size={24} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {[item.Name, item.Lastname].filter(Boolean).join(" ")} • {item.total}
          </Text>
          {!!item.FacultyName && (
            <View style={styles.metaPill}>
              <Ionicons name="school-outline" size={14} color={primary} />
              <Text style={styles.metaText}>{item.FacultyName}</Text>
            </View>
          )}

          {isExpanded && (
            <View style={{ marginTop: 12 }}>
              {/* Lista pitanja sa edit poljima */}
              {item.items
                .sort((a, b) => a.QuestionNumber - b.QuestionNumber)
                .map((row) => {
                  const qKey = String(row.QuestionNumber);
                  const current = edits[uid]?.[qKey];
                  return (
                    <View key={`${uid}-${qKey}`} style={styles.resultRow}>
                      <View style={styles.resultMeta}>
                        <Ionicons name="help-circle-outline" size={16} color={primary} />
                        <Text style={styles.resultMetaText}>Pitanje #{qKey}</Text>
                      </View>
                      <View style={styles.inputIconField}>
                        <Ionicons name="analytics-outline" size={18} color={primary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputIconText}
                          value={current !== undefined ? String(current) : String(row.Score ?? "")}
                          onChangeText={(t) => setEditScore(uid, qKey, t)}
                          keyboardType="numeric"
                          placeholder="bodovi"
                        />
                      </View>
                    </View>
                  );
                })}

              {/* Dodavanje novog pitanja za ovog korisnika */}
              <View style={[styles.resultRow, { marginTop: 14 }]}>
                <Text style={[styles.resultMetaText, { marginBottom: 6 }]}>Dodaj novo pitanje</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={[styles.inputIconField, { flex: 1 }]}>
                    <Ionicons name="help-circle-outline" size={18} color={primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputIconText}
                      value={newRow[uid]?.question || ""}
                      onChangeText={(t) => setNewRowForUser(uid, "question", t)}
                      keyboardType="numeric"
                      placeholder="Broj pitanja"
                    />
                  </View>
                  <View style={[styles.inputIconField, { flex: 1 }]}>
                    <Ionicons name="analytics-outline" size={18} color={primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputIconText}
                      value={newRow[uid]?.score || ""}
                      onChangeText={(t) => setNewRowForUser(uid, "score", t)}
                      keyboardType="numeric"
                      placeholder="Bodovi"
                    />
                  </View>
                </View>
              </View>

              {/* SAČUVAJ za sve izmjene ovog korisnika */}
              <View style={styles.formButtonsRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, savingUser && styles.disabled]}
                  disabled={savingUser}
                  onPress={() => saveUserChanges(uid)}
                >
                  <Text style={styles.primaryBtnLabel}>SAČUVAJ</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => toggleExpand(uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-forward"} size={20} color="#999" />
        </TouchableOpacity>
      </View>
    );
  };

  if (!canAccess) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#999" />
        <Text style={styles.denied}>Nemate ovlaštenje za ovu stranicu.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
    <View style={styles.container}>
      <Text style={styles.title}>Pregled/izmjena rezultata</Text>

      {/* Odabir takmičenja */}
      <DropdownSelect
        label="Takmičenje*"
        items={competitions}
        value={selectedCompetitionId}
        onChange={setSelectedCompetitionId}
        placeholder="Odaberite takmičenje..."
        loading={loadingCompetitions}
        iconName="flask-outline"
        searchable
      />

      {/* Opciono: globalno dodavanje (zadrzano zbog ranijeg zahtjeva) */}
      <View style={[styles.formButtonsRow, styles.formButtonsRowAboveList]}>
        <TouchableOpacity
          style={[styles.primaryBtn]}
          onPress={async () => {
            if (!selectedCompetitionId) {
              showAlert("Greška", "Prvo odaberite takmičenje.");
              return;
            }
            await loadUsersForCompetition();
            setAddModalOpen(true);
          }}
        >
          <Text style={styles.primaryBtnLabel}>DODAJ REZULTAT</Text>
        </TouchableOpacity>
      </View>

      {/* Lista rezultata (grupisano, sortirano po total desc) */}
      {resultsLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
      ) : groupedByUser.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={42} color={primary} />
          <Text style={styles.emptyText}>Nema rezultata za odabrano takmičenje.</Text>
        </View>
      ) : (
        <FlatList
          data={groupedByUser}
          keyExtractor={(u) => String(u.IdUser)}
          renderItem={renderUserCard}
          contentContainerStyle={{ paddingBottom: 120 }}
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

      {/* Modal: Dodaj rezultat (za korisnika bez zapisa ili bilo kog) */}
      <Modal visible={addModalOpen} transparent animationType="fade" onRequestClose={() => setAddModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalOpen(false)}>
          <Pressable style={styles.formModalCard}>
            <Text style={styles.modalTitle}>Dodaj rezultat</Text>
            <Text style={styles.modalSubtitle}>Popunite obavezna polja.</Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
              {/* Korisnik* */}
              <DropdownSelect
                label="Korisnik*"
                items={usersForCompetition}
                value={newUserId}
                onChange={setNewUserId}
                placeholder="Odaberite korisnika..."
                loading={usersLoading}
                iconName="person-outline"
                searchable
              />

              {/* Broj pitanja* */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Broj pitanja*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="help-circle-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={newQuestionNumber}
                    onChangeText={setNewQuestionNumber}
                    keyboardType="numeric"
                    placeholder="npr. 10"
                  />
                </View>
              </View>

              {/* Bodovi* */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Bodovi*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="analytics-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={newScore}
                    onChangeText={setNewScore}
                    keyboardType="numeric"
                    placeholder="npr. 5"
                  />
                </View>
              </View>

              <View style={styles.formButtonsRow}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAddResult}>
                  <Text style={styles.primaryBtnLabel}>SAČUVAJ</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setAddModalOpen(false)}>
              <Text style={styles.cancelLabel}>OTKAŽI</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 15, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15, color: "#333", textAlign: "left" },

  // select field
  inputRow: { marginBottom: 12 },
  inputLabel: { fontSize: 13, color: "#555", marginBottom: 6 },
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

  // Modal i dropdown
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
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#222", marginBottom: 10 },
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

  // kartice
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  metaText: { fontSize: 12, color: primary, fontWeight: "600" },

  // Detalji
  resultRow: { marginTop: 8 },
  resultMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  resultMetaText: { fontSize: 13, color: "#333", fontWeight: "600" },
  inputIconField: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  inputIcon: { marginRight: 8 },
  inputIconText: { flex: 1, fontSize: 15, color: "#333" },

  // dugmad
  formButtonsRow: { marginTop: 12, flexDirection: "row", justifyContent: "center" },
  formButtonsRowAboveList: { marginBottom: 16 },
  primaryBtn: {
    backgroundColor: primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  primaryBtnLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },

  // ostalo
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", marginTop: 20 },
  emptyText: { marginTop: 8, fontSize: 16, color: "#666" },
  denied: { marginTop: 10, fontSize: 16, color: "#999" },

  // shared modal card
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
  modalSubtitle: { fontSize: 14, color: "#666", marginBottom: 16 },
  cancelButton: { position: "absolute", right: 16, bottom: 12, paddingHorizontal: 6, paddingVertical: 4 },
  cancelLabel: { color: primary, fontSize: 14, fontWeight: "600" },
});

export default ScienceResultsScreen;