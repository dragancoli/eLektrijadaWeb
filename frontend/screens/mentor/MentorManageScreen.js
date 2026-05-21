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
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";

const primary = "#10345bff";
const orange = "#fa8d10ff";
const danger = "#d64545";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MentorManageScreen = () => {
  const { user } = useAuth();
  
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [updates, setUpdates] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidPickingTime, setAndroidPickingTime] = useState(false);
  const [activePickerId, setActivePickerId] = useState(null);

  const [compDetails, setCompDetails] = useState({}); 
  const [tableScores, setTableScores] = useState({}); 
  const [savingBulk, setSavingBulk] = useState(false);

  const formatDateTimeLocal = (date) => {
    if (!date) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const showAlert = (title, message) => {
    if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
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

  const loadCompetitionDetails = async (competitionId, compItem) => {
    setCompDetails((prev) => ({ ...prev, [competitionId]: { ...prev[competitionId], loading: true } }));
    try {
      const usersRes = await apiClient.get(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}/users`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      let resultsData = [];
      try {
        const resultsRes = await apiClient.get(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}/results`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        resultsData = resultsRes.data || [];
      } catch (err) {
        if (err.response?.status !== 404) throw err; 
      }

      const initialDraft = {};
      usersRes.data?.forEach(u => { initialDraft[u.IdUser] = {}; });
      
      resultsData.forEach(r => {
        if (!initialDraft[r.IdUser]) initialDraft[r.IdUser] = {};
        initialDraft[r.IdUser][r.QuestionNumber] = r.Score != null ? r.Score.toString() : "";
      });

      setTableScores(initialDraft);

      setCompDetails((prev) => ({
        ...prev,
        [competitionId]: { users: usersRes.data || [], results: resultsData, loading: false },
      }));
    } catch (error) {
      console.error("Error loading details:", error);
      setCompDetails((prev) => ({
        ...prev,
        [competitionId]: { users: [], results: [], loading: false, error: true },
      }));
    }
  };

  useEffect(() => {
    loadCompetitions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    if (expandedId) {
      const comp = competitions.find(c => c.IdScienceCompetition === expandedId);
      if (comp) await loadCompetitionDetails(expandedId, comp);
    }
    setRefreshing(false);
  };

  const toggleExpand = (item) => {
    const id = item.IdScienceCompetition;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadCompetitionDetails(id, item);
    }
    setShowDatePicker(false);
    setAndroidPickingTime(false);
    setActivePickerId(null);
  };

  const handleScoreChange = (userId, qNum, val) => {
    const cleanVal = val.replace(/[^0-9.,]/g, "").replace(",", ".");
    setTableScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [qNum]: cleanVal
      }
    }));
  };

  const saveBulkResults = async (competitionId) => {
    setSavingBulk(true);
    try {
      const originalResults = compDetails[competitionId]?.results || [];
      const promises = [];
      const url = `/sciences/mentors/${user.IdUser}/competitions/${competitionId}/results`;

      for (const userId of Object.keys(tableScores)) {
        for (const qNum of Object.keys(tableScores[userId])) {
          const val = tableScores[userId][qNum];
          const numVal = parseFloat(val);
          const orig = originalResults.find(r => r.IdUser == userId && r.QuestionNumber == qNum);

          if (val === "" && orig) {
            promises.push(apiClient.delete(`${url}/${userId}/${qNum}`, { headers: { Authorization: `Bearer ${user.token}` } }));
          } else if (val !== "" && !isNaN(numVal)) {
            if (orig && orig.Score !== numVal) {
              promises.push(apiClient.put(url, { userId: parseInt(userId), questionNumber: parseInt(qNum), score: numVal }, { headers: { Authorization: `Bearer ${user.token}` } }));
            } else if (!orig) {
              promises.push(apiClient.post(url, { userId: parseInt(userId), questionNumber: parseInt(qNum), score: numVal }, { headers: { Authorization: `Bearer ${user.token}` } }));
            }
          }
        }
      }

      if (promises.length === 0) {
        showAlert("Info", "Nema izmjena za spašavanje.");
        setSavingBulk(false);
        return;
      }

      await Promise.all(promises);
      showAlert("Uspjeh", "Svi rezultati su uspješno sačuvani!");
      
      const comp = competitions.find(c => c.IdScienceCompetition === competitionId);
      loadCompetitionDetails(competitionId, comp);

    } catch (error) {
      console.error(error);
      showAlert("Greška", "Došlo je do greške pri spašavanju nekih rezultata.");
    } finally {
      setSavingBulk(false);
    }
  };


  const handleUpdateField = (id, field, value) => {
    setUpdates((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const startAndroidPicker = (id) => { setActivePickerId(id); setAndroidPickingTime(false); setShowDatePicker(true); };
  
  const onChangeAndroidDate = (event, pickedDate, id) => {
    if (event.type === "dismissed") return setShowDatePicker(false);
    const currentVal = updates[id]?.StartDate ? new Date(updates[id].StartDate) : new Date();
    const base = pickedDate || new Date();
    const withDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), currentVal.getHours(), currentVal.getMinutes());
    handleUpdateField(id, "StartDate", withDate.toISOString());
    setShowDatePicker(false);
    setAndroidPickingTime(true);
  };

  const onChangeAndroidTime = (event, pickedTime, id) => {
    if (event.type === "dismissed") return setAndroidPickingTime(false);
    const currentVal = updates[id]?.StartDate ? new Date(updates[id].StartDate) : new Date();
    const time = pickedTime || new Date();
    const withTime = new Date(currentVal.getFullYear(), currentVal.getMonth(), currentVal.getDate(), time.getHours(), time.getMinutes());
    handleUpdateField(id, "StartDate", withTime.toISOString());
    setAndroidPickingTime(false);
    setActivePickerId(null);
  };

  const submitUpdate = async (competitionId) => {
    const body = updates[competitionId];
    if (!body || Object.keys(body).length === 0) return showAlert("Info", "Nema izmjena za slanje.");
    try {
      await apiClient.put(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}`, body, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      showAlert("Uspjeh", "Podaci su ažurirani.");
      setUpdates((prev) => ({ ...prev, [competitionId]: {} }));
      
      await loadCompetitions();
    } catch (err) {
      showAlert("Greška", err.response?.data?.message || "Neuspješno ažuriranje.");
    }
  };

  const removeReviewAppointment = (competitionId) => {
    const confirmAction = async () => {
      try {
        await apiClient.put(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}`, { RemoveReviewAppointment: true }, { headers: { Authorization: `Bearer ${user.token}` } });
        setUpdates((prev) => ({ ...prev, [competitionId]: {} }));
        loadCompetitions();
      } catch (err) {
        showAlert("Greška", err.response?.data?.message || "Neuspješno uklanjanje termina uvida.");
      }
    };
    if (Platform.OS === "web" && window.confirm("Da li ste sigurni? Termin uvida će biti uklonjen.")) confirmAction();
    else if (Platform.OS !== "web") Alert.alert("Ukloni termin", "Da li ste sigurni?", [{ text: "Odustani", style: "cancel" }, { text: "Ukloni", style: "destructive", onPress: confirmAction }]);
  };

  const pickSolutionFile = async (competitionId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled) uploadFile(competitionId, result.assets[0]);
    } catch (err) { showAlert("Greška", "Greška pri odabiru fajla."); }
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
        formData.append("document", { uri: file.uri, name: file.name, type: file.mimeType || "application/octet-stream" });
      }
      await apiClient.post(`/sciences/mentors/${user.IdUser}/competitions/${competitionId}/solution`, formData, {
        headers: { Authorization: `Bearer ${user.token}`, Accept: "application/json" },
        transformRequest: (data) => data,
      });
      showAlert("Upload završen", "Rješenje je uspješno postavljeno na server!");
      loadCompetitions();
    } catch (err) { showAlert("Greška", "Neuspješan upload."); } finally { setUploadingId(null); }
  };

  const exportToPDF = async (competitionId, item) => {
    try {
      const details = compDetails[competitionId];
      if (!details || details.users.length === 0) {
        return showAlert("Info", "Nema podataka za eksport.");
      }

      let logoUri = "";
      try {
        const asset = await Asset.loadAsync(require("../../assets/logo.png"));
        logoUri = asset[0].localUri || asset[0].uri;
      } catch (e) {
        console.warn("Logo nije pronađen, preskačem logo u PDF-u.");
      }

      const maxResultQ = details.results?.reduce((max, r) => Math.max(max, r.QuestionNumber), 0) || 0;
      const parsedColsCount = Math.max(parseInt(item.NumberOfQuestions) || 0, maxResultQ);
      const columns = Array.from({ length: parsedColsCount }, (_, i) => i + 1);

      const tableRows = details.users.map(u => {
        let scoresHtml = "";
        let total = 0;
        
        columns.forEach(c => {
          const val = tableScores[u.IdUser]?.[c] || "";
          const num = parseFloat(val);
          
          if (!isNaN(num)) {
            total += num;
            scoresHtml += `<td>${num.toFixed(2)}</td>`;
          } else {
            scoresHtml += `<td>-</td>`;
          }
        });

        return `
          <tr>
            <td style="text-align: left; font-weight: bold;">${u.Name} ${u.Lastname}</td>
            ${scoresHtml}
            <td style="font-weight: bold; color: #10345b;">${total.toFixed(2)}</td>
          </tr>
        `;
      }).join("");

      const appointmentStr = item.Review_Appointment_Date 
        ? formatDateTimeLocal(new Date(item.Review_Appointment_Date)) 
        : "Nije definisano";
      const durationStr = item.Review_Appointment_Duration ? `${item.Review_Appointment_Duration} min` : "-";
      const locationStr = item.Review_Appointment_Location || "-";

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              * { box-sizing: border-box; }
              
              body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 30px; color: #333; }
              .header { display: flex; align-items: center; border-bottom: 2px solid #10345b; padding-bottom: 20px; margin-bottom: 30px; }
              .logo { width: 80px; height: 80px; object-fit: contain; margin-right: 20px; }
              .title-container { flex: 1; }
              .title { margin: 0; font-size: 24px; color: #10345b; text-transform: uppercase; }
              .subtitle { margin: 5px 0 0 0; font-size: 16px; color: #666; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; table-layout: fixed; border: 1px solid #ddd; }
              
              th, td { border: 1px solid #ddd; padding: 4px; text-align: center; overflow: hidden; white-space: nowrap; }
              
              th { background-color: #f4f8fc; color: #10345b; text-transform: uppercase; font-size: 11px; }
              tr:nth-child(even) { background-color: #fafafa; }
              
              .footer { background-color: #f4f8fc; padding: 15px; border-radius: 8px; border-left: 5px solid #fa8d10; margin-top: 30px; }
              .footer h4 { margin: 0 0 10px 0; color: #10345b; font-size: 14px; text-transform: uppercase; }
              .footer p { margin: 4px 0; font-size: 13px; }
              
              @media print {
                body { padding: 0; }
                @page { size: landscape; margin: 15mm; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoUri ? `<img src="${logoUri}" class="logo" />` : ""}
              <div class="title-container">
                <h1 class="title">Zvanični rezultati</h1>
                <p class="subtitle">${item.Science_Name} - Godina: ${item.Year || "N/A"}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="text-align: left; width: 30%;">Takmičar</th>
                  ${columns.map(c => `<th>P${c}</th>`).join("")}
                  <th style="font-size: 16px;">&Sigma;</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer">
              <h4>Termin uvida u radove</h4>
              <p><strong>Datum i vrijeme:</strong> ${appointmentStr}</p>
              <p><strong>Trajanje:</strong> ${durationStr}</p>
              <p><strong>Lokacija:</strong> ${locationStr}</p>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(htmlContent);
          printWindow.document.close(); 
          
          printWindow.focus();
          
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        } else {
          showAlert("Upozorenje", "Pretraživač je blokirao otvaranje prozora. Molimo vas omogućite pop-up prozore za ovu stranicu.");
        }
      } else {
        const file = await Print.printToFileAsync({ 
          html: htmlContent,
          base64: false
        });
        
        if (file && file.uri) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Rezultati_${item.Science_Name}.pdf`,
            UTI: 'com.adobe.pdf'
          });
        }
      }

    } catch (error) {
      console.error("Greška pri kreiranju PDF-a:", error);
      showAlert("Greška", "Nije moguće generisati PDF dokument.");
    }
  };

  const renderReviewDateInput = (item) => {
    const id = item.IdScienceCompetition;
    const currentValStr = updates[id]?.StartDate || item.Review_Appointment_Date;
    const currentDate = currentValStr ? new Date(currentValStr) : null;

    if (Platform.OS === "web") {
      const toLocalInputValue = (date) => date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
      return (
        <input type="datetime-local" value={toLocalInputValue(currentDate)} onChange={(e) => handleUpdateField(id, "StartDate", e.target.value ? new Date(e.target.value).toISOString() : null)} style={styles.webDateInput} />
      );
    }
    if (Platform.OS === "android") {
      return (
        <>
          <TouchableOpacity style={styles.dateDisplay} onPress={() => startAndroidPicker(id)}>
            <Ionicons name="calendar-outline" size={18} color={primary} />
            <Text style={styles.dateDisplayText}>{currentDate ? formatDateTimeLocal(currentDate) : "Odaberite datum i vrijeme uvida"}</Text>
          </TouchableOpacity>
          {showDatePicker && activePickerId === id && <DateTimePicker value={currentDate || new Date()} mode="date" onChange={(ev, date) => onChangeAndroidDate(ev, date, id)} />}
          {androidPickingTime && activePickerId === id && <DateTimePicker value={currentDate || new Date()} mode="time" onChange={(ev, date) => onChangeAndroidTime(ev, date, id)} />}
        </>
      );
    }
    return (
      <>
        <TouchableOpacity style={styles.dateDisplay} onPress={() => { setActivePickerId(id); setShowDatePicker(!showDatePicker); }}>
          <Ionicons name="calendar-outline" size={18} color={primary} />
          <Text style={styles.dateDisplayText}>{currentDate ? formatDateTimeLocal(currentDate) : "Odaberite datum i vrijeme uvida"}</Text>
        </TouchableOpacity>
        {showDatePicker && activePickerId === id && <DateTimePicker value={currentDate || new Date()} mode="datetime" display="inline" onChange={(ev, date) => date && handleUpdateField(id, "StartDate", date.toISOString())} />}
      </>
    );
  };

  const renderCompetitionItem = ({ item }) => {
    const id = item.IdScienceCompetition;
    const update = updates[id] || {};
    const isExpanded = expandedId === id;
    const isUploading = uploadingId === id;
    const details = compDetails[id] || { loading: true, users: [], results: [] };

    const maxResultQ = details.results?.reduce((max, r) => Math.max(max, r.QuestionNumber), 0) || 0;
    const parsedColsCount = Math.max(parseInt(item.NumberOfQuestions) || 0, maxResultQ);
    const columns = Array.from({ length: parsedColsCount }, (_, i) => i + 1);

    return (
      <View style={[styles.card, isExpanded && styles.cardExpanded]}>
        <TouchableOpacity 
          style={[styles.cardHeader, isExpanded && styles.cardHeaderExpanded]} 
          onPress={() => toggleExpand(item)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, isExpanded && styles.titleExpanded]}>
              {item.Science_Name}
            </Text>
            <Text style={styles.subtitle}>Godina: {item.Year || "N/A"}</Text>
          </View>
          <View style={[styles.chevronContainer, isExpanded && styles.chevronContainerExpanded]}>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={isExpanded ? "#fff" : primary} 
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            {/* --- SEKCIJA 1: POSTAVKE TAKMIČENJA --- */}
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>POSTAVKE TAKMIČENJA</Text>
            </View>
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

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Datum i vrijeme uvida</Text>
              {renderReviewDateInput(item)}
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputRow, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Trajanje (min)</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="time-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput style={styles.inputIconText} keyboardType="numeric" value={update.Duration?.toString() ?? item.Review_Appointment_Duration?.toString() ?? ""} onChangeText={(val) => handleUpdateField(id, "Duration", val)} placeholder="npr. 15" />
                </View>
              </View>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Lokacija</Text>
                <View style={styles.inputIconField}>
                  <Ionicons name="location-outline" size={18} color={primary} style={styles.inputIcon} />
                  <TextInput style={styles.inputIconText} value={update.Location ?? item.Review_Appointment_Location ?? ""} onChangeText={(val) => handleUpdateField(id, "Location", val)} placeholder="Kabinet..." />
                </View>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.updateBtn} onPress={() => submitUpdate(id)}><Text style={styles.btnTextWhite}>SAČUVAJ POSTAVKE</Text></TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeReviewAppointment(id)}><Ionicons name="trash-outline" size={18} color="#fff" /></TouchableOpacity>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => pickSolutionFile(id)} disabled={isUploading}>
                {isUploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            {/* --- SEKCIJA 2: TABELARNI UNOS REZULTATA --- */}
            <View style={[styles.sectionHeaderRow, { marginTop: 25, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 }]}>
                <Text style={styles.sectionHeaderTitle}>TABELARNI UNOS REZULTATA</Text>
            </View>

            {details.loading ? (
              <ActivityIndicator size="small" color={primary} style={{ marginVertical: 20 }} />
            ) : details.users.length === 0 ? (
              <Text style={styles.emptyText}>Nema prijavljenjenih takmičara za ovo takmičenje.</Text>
            ) : parsedColsCount === 0 ? (
              <Text style={styles.emptyText}>Unesite i sačuvajte broj pitanja u postavkama iznad da bi se prikazala tabela.</Text>
            ) : (
              <View style={styles.gridContainer}>
                <View style={styles.gridRowLayout}>
                  
                  {/* LJEVA STRANA (Fiksna imena) */}
                  <View style={styles.fixedColumn}>
                    <View style={styles.gridHeaderCell}><Text style={styles.gridHeaderText}>Takmičar</Text></View>
                    {details.users.map(u => (
                      <View key={u.IdUser} style={styles.gridNameCell}>
                        <Text style={styles.gridNameText} numberOfLines={1}>{u.Name} {u.Lastname}</Text>
                      </View>
                    ))}
                  </View>

                  {/* DESNA STRANA (Skrolabilne kolone) */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ flex: 1 }}>
                    <View>
                      {/* Zaglavlje kolona */}
                      <View style={styles.gridRow}>
                        {columns.map(c => (
                          <View key={`h-${c}`} style={styles.gridInputCellHeader}>
                            <Text style={styles.gridHeaderText}>P{c}</Text>
                          </View>
                        ))}
                        <View style={styles.gridTotalCellHeader}>
                          <Text style={styles.gridHeaderText}>Ukupno</Text>
                        </View>
                      </View>

                      {/* Redovi sa inputima */}
                      {details.users.map(u => {
                        let total = 0;
                        if (tableScores[u.IdUser]) {
                          Object.values(tableScores[u.IdUser]).forEach(val => {
                            const num = parseFloat(val);
                            if (!isNaN(num)) total += num;
                          });
                        }

                        return (
                          <View key={`r-${u.IdUser}`} style={styles.gridRow}>
                            {columns.map(c => (
                              <View key={`i-${u.IdUser}-${c}`} style={styles.gridInputCell}>
                                <TextInput
                                  style={styles.gridInput}
                                  keyboardType="numeric"
                                  placeholder="-"
                                  placeholderTextColor="#ccc"
                                  value={tableScores[u.IdUser]?.[c] || ""}
                                  onChangeText={(val) => handleScoreChange(u.IdUser, c, val)}
                                />
                              </View>
                            ))}
                            <View style={styles.gridTotalCell}>
                              <Text style={styles.gridTotalText}>{total.toFixed(2)}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* NOVO: Red sa dugmadima za čuvanje i PDF eksport */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity 
                    style={[styles.saveBulkBtn, { flex: 1 }]} 
                    onPress={() => saveBulkResults(id)} 
                    disabled={savingBulk}
                  >
                    {savingBulk ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBulkBtnText}>SAČUVAJ SVE REZULTATE</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.pdfBtn} 
                    onPress={() => exportToPDF(id, item)} 
                  >
                    <Ionicons name="document-text-outline" size={20} color="#fff" />
                    <Text style={styles.pdfBtnText}>PDF</Text>
                  </TouchableOpacity>
                </View>

              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>Upravljanje takmičenjima</Text>
      
      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
      ) : (
        <FlatList
          data={competitions}
          keyExtractor={(item) => String(item.IdScienceCompetition)}
          renderItem={renderCompetitionItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Nema dodijeljenih takmičenja.</Text>}
        />
      )}
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>Upravljanje takmičenjima</Text>
      
      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
      ) : (
        <FlatList
          data={competitions}
          keyExtractor={(item) => String(item.IdScienceCompetition)}
          renderItem={renderCompetitionItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Nema dodijeljenih takmičenja.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingHorizontal: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  screenTitle: { fontSize: 22, fontWeight: "bold", color: "#333", marginVertical: 15 },
  
  card: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  cardExpanded: { borderColor: primary, borderWidth: 2, elevation: 8, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, marginTop: 8, marginBottom: 24 },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#fff", borderRadius: 12 },
  cardHeaderExpanded: { backgroundColor: "#f4f8fc", borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 16, fontWeight: "600", color: "#333" },
  titleExpanded: { color: primary, fontWeight: "800" }, 
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  chevronContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f0f4f8", alignItems: "center", justifyContent: "center", marginLeft: 10 },
  chevronContainerExpanded: { backgroundColor: primary },
  cardBody: { padding: 15, backgroundColor: "#fafafa", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },

  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  sectionHeaderTitle: { fontSize: 13, fontWeight: "800", color: "#888", letterSpacing: 0.5 },
  inputRow: { marginBottom: 12 },
  rowInputs: { flexDirection: "row", justifyContent: "space-between" },
  inputLabel: { fontSize: 12, color: "#555", marginBottom: 6, fontWeight: "600" },
  inputIconField: { height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff", paddingHorizontal: 10, flexDirection: "row", alignItems: "center" },
  inputIcon: { marginRight: 6 },
  inputIconText: { flex: 1, fontSize: 14, color: "#333" },
  dateDisplay: { height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  dateDisplayText: { fontSize: 14, color: "#333", flex: 1 },
  webDateInput: { height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff", padding: "0 10px", fontSize: 14, width: "100%", boxSizing: "border-box" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  updateBtn: { flex: 1, backgroundColor: primary, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deleteBtn: { backgroundColor: danger, width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  uploadBtn: { backgroundColor: orange, width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnTextWhite: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyText: { textAlign: "center", color: "#999", fontSize: 14, marginTop: 10, fontStyle: 'italic' },

  gridContainer: { marginTop: 10, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0", overflow: 'hidden' },
  gridRowLayout: { flexDirection: 'row' },
  
  fixedColumn: { width: 120, borderRightWidth: 1, borderRightColor: "#e0e0e0", backgroundColor: "#fafafa", zIndex: 1 },
  gridHeaderCell: { height: 45, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e0e0e0", backgroundColor: "#f0f4f8" },
  gridNameCell: { height: 45, justifyContent: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#eee", backgroundColor: "#fff" },
  gridHeaderText: { fontSize: 12, fontWeight: "bold", color: "#333" },
  gridNameText: { fontSize: 12, color: "#333", fontWeight: "600" },

  gridRow: { flexDirection: "row" },
  gridInputCellHeader: { width: 60, height: 45, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderRightWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#f0f4f8" },
  gridTotalCellHeader: { width: 80, height: 45, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#e8efff" },
  
  gridInputCell: { width: 60, height: 45, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderRightWidth: 1, borderColor: "#eee", backgroundColor: "#fff" },
  gridInput: { width: "80%", height: 35, textAlign: "center", fontSize: 13, color: "#333", backgroundColor: "#f9f9f9", borderRadius: 4, borderWidth: 1, borderColor: "#e0e0e0" },
  
  gridTotalCell: { width: 80, height: 45, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderColor: "#eee", backgroundColor: "#fafcfd" },
  gridTotalText: { fontSize: 14, fontWeight: "bold", color: primary },

  saveBulkBtn: { backgroundColor: primary, margin: 15, height: 45, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  saveBulkBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },

  actionButtonsRow: { flexDirection: "row", gap: 10, margin: 15 },
  pdfBtn: { backgroundColor: "#d64545", paddingHorizontal: 15, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  pdfBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});

export default MentorManageScreen;