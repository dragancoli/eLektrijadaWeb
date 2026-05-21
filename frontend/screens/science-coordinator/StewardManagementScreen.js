import React, { useEffect, useState, useCallback, useMemo } from "react";
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

const primary = "#10345bff";
const orange = "#fa8d10ff";

const showAlert = (title, message) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message || ""}`);
  else Alert.alert(title, message);
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reusable DropdownSelect (isti princip kao u ScienceCompetitionsScreen)
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

const StewardManagementScreen = () => {
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

  // Faculties (picker)
  const [faculties, setFaculties] = useState([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);

  // Form state
  const [fName, setFName] = useState("");
  const [fLastname, setFLastname] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fIdFaculty, setFIdFaculty] = useState(""); // stores numeric id
  const [fIsActive, setFIsActive] = useState(true);

  // Password change state
  const [fNewPassword, setFNewPassword] = useState("");
  const [fConfirmPassword, setFConfirmPassword] = useState("");

  const resetForm = () => {
    setFName("");
    setFLastname("");
    setFEmail("");
    setFPassword("");
    setFIdFaculty("");
    setFIsActive(true);
    setFNewPassword("");
    setFConfirmPassword("");
  };

  const fetchList = async () => {
    if (!canAccess) return;
    try {
      setLoading(true);
      const res = await apiClient.get("/stewards", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setList(res.data || []);
    } catch (e) {
      showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje redara.");
    } finally {
      setLoading(false);
    }
  };

  const loadFaculties = async () => {
  try {
    setLoadingFaculties(true);
    const res = await apiClient.get("/faculties", {
      headers: { Authorization: `Bearer ${user?.token}` },
    });
    const mapped = (res.data || []).map((f) => ({
      label: f.Name,
      value: String(f.IdFaculty),
    }));
    setFaculties(mapped);
  } catch (e) {
    setFaculties([]);
    showAlert("Greška", e.response?.data?.message || "Neuspješno učitavanje fakulteta.");
  } finally {
    setLoadingFaculties(false);
  }
};

  useEffect(() => {
    fetchList();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  }, []);

  const openCreate = async () => {
    resetForm();
    setFormMode("create");
    setFormModalOpen(true);
    await loadFaculties();
  };

  const openEdit = async (steward) => {
    setFormMode("edit");
    setSelected(steward);
    setFName(steward.Name || "");
    setFLastname(steward.Lastname || "");
    setFEmail(steward.Email || "");
    setFPassword(""); // password se ne mijenja ovdje
    setFIdFaculty(steward.IdFaculty ? String(steward.IdFaculty) : "");
    setFIsActive(!!steward.IsActive);
    setFormModalOpen(true);
    await loadFaculties();
  };

  const validateCreate = () => {
    const errors = [];
    if (!fName.trim()) errors.push("Ime je obavezno.");
    if (!fLastname.trim()) errors.push("Prezime je obavezno.");
    if (!fEmail.trim()) errors.push("Email je obavezan.");
    else if (!emailRegex.test(fEmail.trim())) errors.push("Email nije validan.");
    if (!fPassword.trim()) errors.push("Lozinka je obavezna.");
    else if (fPassword.length < 8) errors.push("Lozinka mora imati najmanje 8 karaktera.");
    if (!fIdFaculty) errors.push("Fakultet se mora odabrati.");
    else {
      const n = Number(fIdFaculty);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) errors.push("Fakultet mora biti pozitivan cijeli broj.");
    }

    if (errors.length) {
      showAlert("Greška", errors.join("\n"));
      return false;
    }
    return true;
  };

  const validateEdit = () => {
    const errors = [];
    if (!fName.trim()) errors.push("Ime je obavezno.");
    if (!fLastname.trim()) errors.push("Prezime je obavezno.");
    if (!fEmail.trim()) errors.push("Email je obavezan.");
    else if (!emailRegex.test(fEmail.trim())) errors.push("Email nije validan.");
    if (!fIdFaculty) errors.push("Fakultet se mora odabrati.");
    else {
      const n = Number(fIdFaculty);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) errors.push("Fakultet mora biti pozitivan cijeli broj.");
    }
    if (errors.length) {
      showAlert("Greška", errors.join("\n"));
      return false;
    }
    return true;
  };

  const submitCreate = async () => {
    if (!validateCreate()) return;
    setSubmitting(true);
    try {
      const payload = {
        Name: fName.trim(),
        Lastname: fLastname.trim(),
        Email: fEmail.trim(),
        Password: fPassword,
        IdFaculty: Number(fIdFaculty),
      };
      const res = await apiClient.post("/stewards", payload, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      setFormModalOpen(false);
      resetForm();
      await fetchList();
      showAlert("Uspjeh", res?.data?.message || "Redar je uspješno dodat.");
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Dodavanje nije uspjelo.";
      showAlert("Greška", reason);
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!selected) return;
    if (!validateEdit()) return;
    
    // Provjeri da li se mijenja lozinka
    const changingPassword = fNewPassword.trim() || fConfirmPassword.trim();
    if (changingPassword) {
      const errors = [];
      if (!fNewPassword.trim()) errors.push("Nova lozinka je obavezna.");
      else if (fNewPassword.length < 8) errors.push("Lozinka mora imati najmanje 8 karaktera.");
      if (!fConfirmPassword.trim()) errors.push("Potvrda lozinke je obavezna.");
      if (fNewPassword !== fConfirmPassword) errors.push("Lozinke se ne poklapaju.");
      
      if (errors.length) {
        showAlert("Greška", errors.join("\n"));
        return;
      }
    }
    
    setSubmitting(true);
    try {
      // Prvo ažuriraj osnovne podatke
      const payload = {
        Name: fName.trim(),
        Lastname: fLastname.trim(),
        IsActive: !!fIsActive,
        IdFaculty: Number(fIdFaculty),
      };
      await apiClient.put(`/stewards/${selected.IdUser}`, payload, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      // Ako se mijenja lozinka, pozovi i endpoint za lozinku
      if (changingPassword) {
        await apiClient.put(
          `/stewards/${selected.IdUser}/password`,
          { newPassword: fNewPassword },
          { headers: { Authorization: `Bearer ${user?.token}` } }
        );
      }

      setFormModalOpen(false);
      setSelected(null);
      resetForm();
      await fetchList();
      
      const successMsg = changingPassword 
        ? "Redarski nalog i lozinka su uspješno izmijenjeni."
        : "Redarski nalog je uspješno izmijenjen.";
      showAlert("Uspjeh", successMsg);
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Izmjena nije uspjela.";
      showAlert("Greška", reason);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (steward) => {
    setSubmitting(true);
    try {
      await apiClient.delete(`/stewards/${steward.IdUser}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setActionModalOpen(false);
      setSelected(null);
      await fetchList();
      showAlert("Uspjeh", "Redarski nalog je uspješno obrisan.");
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Brisanje nije uspjelo.";
      showAlert("Greška", reason);
    } finally {
      setSubmitting(false);
    }
  };


  const renderCard = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => { setSelected(item); setActionModalOpen(true); }}>
      <View style={styles.iconCircle}>
        <Ionicons name="people-outline" size={24} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {[item.Name, item.Lastname].filter(Boolean).join(" ")}
        </Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="mail-outline" size={14} color={primary} />
            <Text style={styles.metaText}>{item.Email}</Text>
          </View>
          {!!item.FacultyName && (
            <View style={styles.metaPill}>
              <Ionicons name="school-outline" size={14} color={primary} />
              <Text style={styles.metaText}>{item.FacultyName}</Text>
            </View>
          )}
          <View style={styles.metaPill}>
            <Ionicons name={item.IsActive ? "checkmark-circle-outline" : "close-circle-outline"} size={14} color={primary} />
            <Text style={styles.metaText}>{item.IsActive ? "Aktivan" : "Neaktivan"}</Text>
          </View>
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
      <Text style={styles.title}>Upravljanje redarskim nalozima</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={42} color={primary} />
          <Text style={styles.emptyText}>Nema redara.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.IdUser)}
          renderItem={renderCard}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* FAB: Dodaj novog redara */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>

      {/* Action modal: Uredi / Obriši (bez konvertovanja) */}
      <Modal visible={actionModalOpen} transparent animationType="fade" onRequestClose={() => setActionModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActionModalOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Redar</Text>
            <Text style={styles.modalSubtitle}>
              {[selected?.Name, selected?.Lastname].filter(Boolean).join(" ")}
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
                  if (Platform.OS === "web") {
                    if (window.confirm("Da li sigurno želite obrisati redara?")) {
                      handleDelete(selected);
                    }
                  } else {
                    Alert.alert(
                      "Potvrda",
                      "Da li sigurno želite obrisati redara?",
                      [
                        { text: "Otkaži", style: "cancel" },
                        { text: "Obriši", style: "destructive", onPress: () => handleDelete(selected) },
                      ],
                      { cancelable: true }
                    );
                  }
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

      {/* Form modal: Create/Edit */}
      <Modal visible={formModalOpen} transparent animationType="fade" onRequestClose={() => setFormModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !submitting && setFormModalOpen(false)}>
          <Pressable style={styles.formModalCard}>
            <Text style={styles.modalTitle}>
              {formMode === "create" ? "Novi redarski nalog" : "Uredi redarski nalog"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {formMode === "create" ? "Popunite obavezna polja." : selected?.Email || ""}
            </Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
              {/* Ime* */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Ime*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="person-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={fName}
                    onChangeText={setFName}
                    placeholder="npr. Marko"
                  />
                </View>
              </View>

              {/* Prezime* */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Prezime*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="person-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={fLastname}
                    onChangeText={setFLastname}
                    placeholder="npr. Kovačević"
                  />
                </View>
              </View>

              {/* Email* */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Email*</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="mail-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconText}
                    value={fEmail}
                    onChangeText={setFEmail}
                    placeholder="npr. marko@fakultet.ba"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {formMode === "create" && (
                <>
                  {/* Lozinka* */}
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Lozinka*</Text>
                    <View style={styles.inputIconField}>
                      <Ionicons name="key-outline" size={18} color={primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputIconText}
                        value={fPassword}
                        onChangeText={setFPassword}
                        placeholder="min. 8 karaktera"
                        secureTextEntry
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Fakultet* – DropdownSelect sa nazivima i ID u pozadini */}
              <DropdownSelect
                label="Fakultet*"
                items={faculties}
                value={fIdFaculty}
                onChange={setFIdFaculty}
                placeholder="Odaberite fakultet..."
                loading={loadingFaculties}
                iconName="school-outline"
                searchable={false}
              />

              {formMode === "edit" && (
                <>
                  {/* Promjena lozinke - opciono */}
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Nova lozinka (opciono)</Text>
                    <View style={styles.inputIconField}>
                      <Ionicons name="key-outline" size={18} color={primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputIconText}
                        value={fNewPassword}
                        onChangeText={setFNewPassword}
                        placeholder="min. 8 karaktera"
                        secureTextEntry
                      />
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Potvrdi lozinku (opciono)</Text>
                    <View style={styles.inputIconField}>
                      <Ionicons name="key-outline" size={18} color={primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputIconText}
                        value={fConfirmPassword}
                        onChangeText={setFConfirmPassword}
                        placeholder="Ponovite lozinku"
                        secureTextEntry
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Status */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name={fIsActive ? "checkmark-circle-outline" : "close-circle-outline"} size={18} color={primary} style={styles.inputIcon} />
                  <TouchableOpacity style={{ flex: 1, height: "100%", justifyContent: "center" }} onPress={() => setFIsActive((v) => !v)}>
                    <Text style={[styles.inputIconText, styles.statusValueText]}>{fIsActive ? "Aktivan" : "Neaktivan"}</Text>
                  </TouchableOpacity>
                </View>
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

  // Inputs
  inputRow: { marginBottom: 12 },
  inputLabel: { fontSize: 13, color: "#555", marginBottom: 6 },

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
  statusValueText: { flex: 0, lineHeight: 18, includeFontPadding: false },

  // Select field (closed)
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

  // Dropdown items (modal)
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
});

export default StewardManagementScreen;