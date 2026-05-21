// screens/AuthProfileScreen.js
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";
import { Picker } from "@react-native-picker/picker";
import { useState, useEffect } from "react";
import { getRoleFeatures, getCommonFeatures, getRoleDisplayName } from "../features/roleFeatures";

const showAlert = (title, message) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message || ""}`);
  } else {
    Alert.alert(title, message);
  }
};

const AuthProfileScreen = ({ navigation }) => {
  const { user, logout, login, register, verifyEmail, deactivateAccount } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Register state
  const [registerIme, setRegisterIme] = useState("");
  const [registerPrezime, setRegisterPrezime] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasswordConfirm, setShowRegisterPasswordConfirm] = useState(false);
  const [faculties, setFaculties] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [loadingFaculties, setLoadingFaculties] = useState(false);

  //Verification
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  useEffect(() => {
    if (!isLogin) {
      loadFaculties();
    }
  }, [isLogin]);

  const loadFaculties = async () => {
    setLoadingFaculties(true);
    try {
      const res = await apiClient.get("/faculties");
      const list = res.data || [];
      setFaculties(list);
      setSelectedFaculty("");
    } catch (e) {
      console.error("Error loading faculties:", e);
      setFaculties([]);
      setSelectedFaculty("");
    } finally {
      setLoadingFaculties(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      showAlert("Greška", "Sva polja su obavezna.");
      return;
    }
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      setLoginEmail("");
      setLoginPassword("");
    } catch (error) {
      showAlert("Neuspješna prijava", error.message || "Provjerite email i lozinku.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerIme || !registerPrezime || !registerEmail || !registerPassword) {
      showAlert("Greška", "Sva polja su obavezna.");
      return;
    }
    if (!selectedFaculty || selectedFaculty === "") {
      showAlert("Greška", "Odaberite fakultet.");
      return;
    }
    if(!registerEmail.includes("@")) {
      showAlert("Greška", "Email nije validan.");
      return;
    }
    if(registerPassword.length < 8) {
      showAlert("Greška", "Lozinka mora imati najmanje 8 karaktera.");
      return;
    }
    if (registerPasswordConfirm && registerPassword !== registerPasswordConfirm) {
      showAlert("Greška", "Lozinka i potvrda lozinke se ne poklapaju.");
      return;
    }
    setRegisterLoading(true);
    try {
      const fakultetId = Number(selectedFaculty);
      await register(registerIme, registerPrezime, registerEmail, registerPassword, fakultetId);
      showAlert("Uspjeh", "Poslat vam je kod za verifikaciju na email.");
      setIsVerifying(true);
    } catch (error) {
      showAlert("Neuspješna registracija", error.message || "Došlo je do greške.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) {
      showAlert("Greška", "Unesite kod za verifikaciju.");
      return;
    }
    setVerifyLoading(true);
    try {
      await verifyEmail(registerEmail, verificationCode);
      showAlert("Uspjeh", "Nalog uspješno verifikovan!");
      setIsVerifying(false);
      setIsLogin(true);
      // Reset fields
      setRegisterIme("");
      setRegisterPrezime("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterPasswordConfirm("");
      setSelectedFaculty("");
      setVerificationCode("");
    } catch (error) {
      showAlert("Greška", error.message || "Verifikacija neuspješna.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Da li ste sigurni da se želite odjaviti?");
      if (confirmed) {
        logout();
      }
    } else {
      Alert.alert("Odjava", "Da li ste sigurni da se želite odjaviti?", [
        { text: "Otkaži", style: "cancel" },
        { text: "Odjavi se", style: "destructive", onPress: logout },
      ]);
    }
  };

  const handleDeactivate = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Da li ste sigurni da želite deaktivirati nalog? Ova akcija je nepovratna.");
      if (confirmed) {
        deactivateAccount("Korisnik je zatražio deaktivaciju.")
          .then(() => {
            window.alert("Nalog je deaktiviran.");
          })
          .catch((e) => {
            window.alert("Greška: " + e.message);
          });
      }
    } else {
      Alert.alert(
        "Deaktivacija naloga",
        "Da li ste sigurni da želite deaktivirati nalog? Ova akcija je nepovratna.",
        [
          { text: "Otkaži", style: "cancel" },
          {
            text: "Deaktiviraj",
            style: "destructive",
            onPress: async () => {
              try {
                await deactivateAccount("Korisnik je zatražio deaktivaciju.");
                Alert.alert("Uspjeh", "Nalog je deaktiviran.");
              } catch (e) {
                Alert.alert("Greška", e.message);
              }
            },
          },
        ]
      );
    }
  };

  // Akcije po ulozi + zajedničke
  const actionsToRender = useMemo(() => {
    // Backend sada vraća naziv uloge u user.UserTypeName (npr. "Student", "Vođa tima", ...)
    const roleName = user?.UserTypeName;
    const roleFeatures = getRoleFeatures(roleName);
    const commonFeatures = getCommonFeatures(handleLogout);

    const toAction = (item) => {
      if (item.key === "deactivate") {
        return { ...item, onPress: handleDeactivate };
      }
      const onPress =
        item.onPress ||
        (item.routeName
          ? () => {
              try {
                navigation.navigate(item.routeName);
              } catch {
                showAlert("Obavještenje", "Ekran još nije dostupan.");
              }
            }
          : () => showAlert("Obavještenje", "Ova funkcionalnost će uskoro biti dostupna."));
      return { ...item, onPress };
    };

    return [...roleFeatures.map(toAction), ...commonFeatures.map(toAction)];
  }, [user, logout, navigation]);

  if (user) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={120} color="#10345bff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{[user.Name, user.Lastname].filter(Boolean).join(" ")}</Text>
            <Text style={styles.email}>{user.Email}</Text>
            {!!user?.UserTypeName && (
              <View style={styles.rolePill}>
                <Ionicons name="ribbon-outline" size={16} color="#10345bff" />
                <Text style={styles.roleText}>{getRoleDisplayName(user)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.optionsContainer}>
          {actionsToRender.map((a) => (
            <TouchableOpacity key={a.key} style={styles.option} onPress={a.onPress} activeOpacity={0.7}>
              <Ionicons name={a.icon} size={24} color={a.destructive ? "#FF3B30" : "#333"} />
              <Text style={[styles.optionText, a.destructive && { color: "#FF3B30", fontWeight: "600" }]}>
                {a.label}
              </Text>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // Guest (login/registration)
  return (
    <ScrollView style={styles.container}>
      <View style={styles.authContainer}>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, isLogin && styles.activeTab]} onPress={() => setIsLogin(true)}>
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Prijava</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, !isLogin && styles.activeTab]} onPress={() => setIsLogin(false)}>
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Registracija</Text>
          </TouchableOpacity>
        </View>

        {isLogin ? (
          <View style={styles.formContainer}>
            <TextInput
              style={[styles.input, styles.inputWithMargin]}
              placeholder="Email"
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Lozinka"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showLoginPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowLoginPassword((s) => !s)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showLoginPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={[styles.submitButton, loginLoading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Prijavi se</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotPasswordButton}>
              <Text style={styles.forgotPasswordText}>Zaboravili ste lozinku?</Text>
            </TouchableOpacity>
          </View>
        ) : isVerifying ? (
          <View style={styles.formContainer}>
            <Text style={styles.title}>Verifikacija naloga</Text>
            <Text style={{ marginBottom: 20, textAlign: 'center', color: '#666' }}>
              Unesite kod koji smo vam poslali na {registerEmail}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Verifikacioni kod"
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity 
              style={[styles.submitButton, verifyLoading && styles.buttonDisabled]} 
              onPress={handleVerify}
              disabled={verifyLoading}
            >
              {verifyLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Verifikuj</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: '#ccc', marginTop: 10 }]} 
              onPress={() => setIsVerifying(false)}
            >
              <Text style={styles.submitButtonText}>Nazad</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ime"
              value={registerIme}
              onChangeText={setRegisterIme}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Prezime"
              value={registerPrezime}
              onChangeText={setRegisterPrezime}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Lozinka"
                value={registerPassword}
                onChangeText={setRegisterPassword}
                secureTextEntry={!showRegisterPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowRegisterPassword((s) => !s)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showRegisterPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Potvrda lozinke"
                value={registerPasswordConfirm}
                onChangeText={setRegisterPasswordConfirm}
                secureTextEntry={!showRegisterPasswordConfirm}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowRegisterPasswordConfirm((s) => !s)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showRegisterPasswordConfirm ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
              </TouchableOpacity>
            </View>

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
                  <Picker.Item
                    label="-- Odaberite fakultet --"
                    value=""
                    color={Platform.OS === "ios" ? "#999" : "#666"}
                  />
                  {faculties.map((f) => (
                    <Picker.Item key={f.IdFaculty} label={f.Name} value={String(f.IdFaculty)} />
                  ))}
                </Picker>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, registerLoading && styles.buttonDisabled]} 
              onPress={handleRegister}
              disabled={registerLoading}
            >
              {registerLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Registruj se</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  authContainer: { padding: 20 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 5,
    marginBottom: 30,
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: "#333",
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 20 },
  activeTab: { backgroundColor: "#10345bff" },
  tabText: { fontSize: 16, color: "#666", fontWeight: "500" },
  activeTabText: { color: "#fff", fontWeight: "600" },
  formContainer: { backgroundColor: "#fff", padding: 20, borderRadius: 15, paddingBottom: 65 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#333" },
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
    marginBottom: 15,
  },
  inputWithMargin: {
    marginBottom: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    marginBottom: 15,
    overflow: "hidden",
    justifyContent: "center",
    minHeight: 50,
  },
  pickerIOS: {
    height: 100,
    width: "100%",
  },
  pickerItemIOS: {
    height: 100,
  },
  pickerAndroid: {
    height: 50,
    width: "100%",
  },
  submitButton: { backgroundColor: "#10345bff", padding: 16, borderRadius: 10, alignItems: "center", marginTop: 10 },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  buttonDisabled: { backgroundColor: "#7a9bbf", opacity: 0.8 },

  forgotPasswordButton: { marginTop: 15, alignItems: "center" },
  forgotPasswordText: { color: "#10345bff", fontSize: 14, fontWeight: "500" },

  profileHeader: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarContainer: { marginBottom: 15 },
  userInfo: { alignItems: "center" },
  username: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 5 },
  email: { fontSize: 16, color: "#666" },
  rolePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EAF3FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleText: { color: "#10345bff", fontWeight: "600", marginLeft: 6, textTransform: "capitalize" },

  optionsContainer: {
    backgroundColor: "#f5f5f5",
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
    flexDirection: "column",
    rowGap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    outlineColor: "#f0f0f0",
    outlineStyle: "solid",
    outlineWidth: 2,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
    color: "#333",
  },
});

export default AuthProfileScreen;
