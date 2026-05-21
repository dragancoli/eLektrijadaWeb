import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";

const EditProfileScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  
  const [name, setName] = useState(user?.Name || "");
  const [lastname, setLastname] = useState(user?.Lastname || "");
  const [selectedFaculty, setSelectedFaculty] = useState(user?.IdFaculty ? String(user.IdFaculty) : "");
  
  const [faculties, setFaculties] = useState([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [saving, setSaving] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    loadFaculties();
  }, []);

  const loadFaculties = async () => {
    setLoadingFaculties(true);
    try {
      const res = await apiClient.get("/faculties");
      setFaculties(res.data || []);
    } catch (e) {
      console.error("Error loading faculties:", e);
      showAlert("Greška", "Neuspješno učitavanje fakulteta.");
    } finally {
      setLoadingFaculties(false);
    }
  };

  const handleSave = async () => {
    if (!name || !lastname || !selectedFaculty) {
      showAlert("Greška", "Sva polja su obavezna.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.patch(
        "/account/details",
        {
          Name: name,
          Lastname: lastname,
          IdFaculty: Number(selectedFaculty),
        },
        {
          headers: { Authorization: `Bearer ${user?.token}` },
        }
      );

      // Update local user context
      const updatedFields = response.data.user;
      await updateUser(updatedFields);

      showAlert("Uspjeh", "Profil je uspješno ažuriran.");
      navigation.goBack();
    } catch (error) {
      console.error("Update profile failed", error);
      const msg = error.response?.data?.error || "Došlo je do greške prilikom ažuriranja profila.";
      showAlert("Greška", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.label}>Ime</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Unesite ime"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Prezime</Text>
        <TextInput
          style={styles.input}
          value={lastname}
          onChangeText={setLastname}
          placeholder="Unesite prezime"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Fakultet</Text>
        <View style={styles.pickerContainer}>
          {loadingFaculties ? (
            <ActivityIndicator size="small" color="#10345bff" />
          ) : (
            <Picker
              selectedValue={selectedFaculty}
              onValueChange={(val) => setSelectedFaculty(String(val))}
              style={Platform.OS === "ios" ? styles.pickerIOS : styles.pickerAndroid}
              itemStyle={Platform.OS === "ios" ? styles.pickerItemIOS : undefined}
            >
              <Picker.Item label="-- Odaberite fakultet --" value="" color="#999" />
              {faculties.map((f) => (
                <Picker.Item key={f.IdFaculty} label={f.Name} value={String(f.IdFaculty)} />
              ))}
            </Picker>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Sačuvaj promjene</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  formContainer: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 50,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  pickerContainer: {
    borderColor: "#e0e0e0",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    marginBottom: 30,
    overflow: "hidden",
    justifyContent: "center",
    minHeight: 50,
  },
  pickerIOS: {
    height: 150,
    width: "100%",
  },
  pickerItemIOS: {
    height: 150,
    fontSize: 16,
  },
  pickerAndroid: {
    height: 50,
    width: "100%",
  },
  saveButton: {
    backgroundColor: "#10345bff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#a0a0a0",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});

export default EditProfileScreen;
