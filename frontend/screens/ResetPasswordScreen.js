import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";

const ResetPasswordScreen = ({ route, navigation }) => {
  const { email } = route.params;
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleCodeChange = (text, index) => {
    if (!/^\d*$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleResetPassword = async () => {
    const codeString = code.join("");
    if (codeString.length !== 6 || !newPassword || !confirmPassword) {
      showAlert("Greška", "Sva polja su obavezna i kod mora imati 6 cifara.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert("Greška", "Lozinke se ne poklapaju.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/account/reset-password", {
        Email: email,
        code: code.join(""),
        newPassword,
        confirmPassword
      });
      showAlert("Uspjeh", "Lozinka je uspješno resetovana. Možete se prijaviti.");
      navigation.navigate("ProfileHome");
    } catch (error) {
      console.error(error);
      showAlert("Greška", error.response?.data?.message || "Došlo je do greške prilikom resetovanja lozinke.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Resetovanje lozinke</Text>
        <Text style={styles.subtitle}>Unesite kod koji ste dobili na email i novu lozinku.</Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.codeInput}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
            />
          ))}
        </View>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Nova lozinka"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowNewPassword((s) => !s)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Potvrda nove lozinke"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword((s) => !s)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]} 
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>{loading ? "Resetovanje..." : "Resetuj lozinku"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 20, justifyContent: "center" },
  formContainer: { backgroundColor: "#fff", padding: 20, borderRadius: 15 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10, textAlign: "center", color: "#333" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20, textAlign: "center" },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  codeInput: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 20,
    backgroundColor: "#f9f9f9",
  },
  inputWrapper: {
    position: "relative",
    marginBottom: 15,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
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
  submitButton: { backgroundColor: "#10345bff", padding: 16, borderRadius: 10, alignItems: "center", marginTop: 10 },
  disabledButton: { backgroundColor: "#ccc" },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});

export default ResetPasswordScreen;
