// context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../api/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Nije uspelo ucitavanje korisnika", e);
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  // Backend: POST /auth/login with { Email, Password }
  const login = async (email, password) => {
    try {
      const response = await apiClient.post("/auth/login", { Email: email, Password: password });
      // Response returns user fields at top-level + token
      const userData = response.data;
      setUser(userData);
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error("Prijava nije uspela", error.message || error);
      // error.message dolazi iz axios interceptora koji formatira poruku
      throw new Error(error.message || "Prijava nije uspela");
    }
  };

  // Backend: POST /auth/register with { Name, Lastname, Email, Password, IdFaculty }
  const register = async (name, lastname, email, password, fakultetId) => {
    try {
      const response = await apiClient.post("/auth/register", {
        Name: name,
        Lastname: lastname,
        Email: email,
        Password: password,
        IdFaculty: Number(fakultetId),
      });
      // Server returns message and email, but no token yet (user not active)
      return response.data;
    } catch (error) {
      console.error("Registracija nije uspjela", error.message || error);
      throw new Error(error.message || "Registracija nije uspjela");
    }
  };

  // Backend: POST /auth/verify-email with { email, code }
  const verifyEmail = async (email, code) => {
    try {
      const response = await apiClient.post("/auth/verify-email", { email, code });
      const userData = response.data;
      setUser(userData);
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error("Verifikacija nije uspjela", error.message || error);
      throw new Error(error.message || "Verifikacija nije uspjela");
    }
  };

  // Change password (PATCH /account/password) without confirm field
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await apiClient.patch("/account/password", {
        currentPassword,
        newPassword,
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      return res.data;
    } catch (error) {
      console.error("Promjena lozinke nije uspjela", error.response?.data || error.message);
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Neuspješna promjena lozinke.";
      throw new Error(message);
    }
  };

  const deactivateAccount = async (reason) => {
    try {
      const res = await apiClient.patch("/account/deactivate", {
        reason,
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      // After deactivation, logout the user
      await logout();
      return res.data;
    } catch (error) {
      console.error("Deaktivacija naloga nije uspjela", error.response?.data || error.message);
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Neuspješna deaktivacija naloga.";
      throw new Error(message);
    }
  };

  const updateUser = async (newUserData) => {
    const updatedUser = { ...user, ...newUserData };
    setUser(updatedUser);
    await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, verifyEmail, logout, changePassword, deactivateAccount, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);