// screens/ChangePasswordScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const ChangePasswordScreen = ({ navigation }) => {
  const { changePassword, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const showSuccess = (message, onOk) => {
    if (Platform.OS === "web") {
      // window.alert is synchronous; call onOk after dismissal
      window.alert(`Uspjeh\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert("Uspjeh", message, [{ text: "OK", onPress: onOk }]);
    }
  };

  const showError = (message) => {
    if (Platform.OS === "web") {
      window.alert(`Greška\n\n${message}`);
    } else {
      Alert.alert("Greška", message);
    }
  };

  const onSubmit = async () => {
    if (!currentPassword || !newPassword) {
      showError("Sva polja su obavezna.");
      return;
    }
    if (newPassword.length < 8) {
      showError("Nova lozinka mora imati najmanje 8 karaktera.");
      return;
    }
    if (currentPassword === newPassword) {
      showError("Nova lozinka ne može biti ista kao trenutna.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSuccess("Lozinka je uspješno promijenjena.", () => navigation.goBack());
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      const msg = e?.message || "Neuspješna promjena lozinke.";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Promjena lozinke</Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Aktivna email adresa</Text>
          <TextInput
            style={[styles.input, styles.readonlyInput]}
            value={user?.Email || ""}
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Trenutna lozinka"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrent}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowCurrent((s) => !s)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Nova lozinka"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowNew((s) => !s)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Sačuvaj</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  formContainer: { backgroundColor: "#fff", padding: 20, borderRadius: 15, margin: 20, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#333" },

  inputWrapper: {
    position: "relative",
    marginBottom: 15,
  },
  input: {
    height: 50,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    paddingHorizontal: 15,
    borderRadius: 20,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  inputLabel: { fontSize: 13, color: "#666", marginBottom: 6, marginLeft: 4 },
  readonlyInput: { backgroundColor: "#f0f0f0" },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  submitButton: {
    backgroundColor: "#10345bff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});

export default ChangePasswordScreen;