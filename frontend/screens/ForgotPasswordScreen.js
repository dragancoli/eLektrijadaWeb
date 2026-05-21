import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import apiClient from "../api/client";

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSendCode = async () => {
    if (!email) {
      showAlert("Greška", "Molimo unesite email adresu.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/account/forgot-password", { Email: email });
      showAlert("Uspjeh", "Ako nalog postoji, kod za resetovanje je poslat na vaš email.");
      navigation.navigate("ResetPassword", { email });
    } catch (error) {
      console.error(error);
      showAlert("Greška", "Došlo je do greške prilikom slanja zahtjeva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Zaboravljena lozinka</Text>
        <Text style={styles.subtitle}>Unesite vašu email adresu da biste dobili kod za resetovanje lozinke.</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]} 
          onPress={handleSendCode}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>{loading ? "Slanje..." : "Pošalji kod"}</Text>
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
  input: {
    height: 50,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 20,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  submitButton: { backgroundColor: "#10345bff", padding: 16, borderRadius: 10, alignItems: "center", marginTop: 10 },
  disabledButton: { backgroundColor: "#ccc" },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});

export default ForgotPasswordScreen;
