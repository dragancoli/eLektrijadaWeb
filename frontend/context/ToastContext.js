// context/ToastContext.js
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ToastContext = createContext();

// Globalna referenca za pristup iz non-React koda (axios interceptor)
let globalShowToast = null;

/**
 * Toast Provider koji omogućava prikazivanje toast poruka iz bilo koje komponente
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const showToast = useCallback(({ message, type = "error", duration = 4000 }) => {
    const id = ++toastId.current;
    
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    // Automatski ukloni toast nakon duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return id;
  }, []);

  const hideToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Postavi globalnu referencu
  globalShowToast = showToast;

  const value = {
    showToast,
    hideToast,
    showError: (message) => showToast({ message, type: "error" }),
    showSuccess: (message) => showToast({ message, type: "success" }),
    showWarning: (message) => showToast({ message, type: "warning" }),
    showInfo: (message) => showToast({ message, type: "info" }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </ToastContext.Provider>
  );
};

/**
 * Hook za korištenje toast-a u komponentama
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast mora biti korišćen unutar ToastProvider-a");
  }
  return context;
};

/**
 * Globalna funkcija za prikazivanje toast-a iz non-React koda
 * Koristi se u axios interceptoru
 */
export const showGlobalToast = (options) => {
  if (globalShowToast) {
    globalShowToast(options);
  } else {
    console.warn("ToastProvider nije mountovan, ne mogu prikazati toast");
  }
};

/**
 * Container koji renderuje sve aktivne toaste
 */
const ToastContainer = ({ toasts, onHide }) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          {...toast}
          index={index}
          onHide={() => onHide(toast.id)}
        />
      ))}
    </View>
  );
};

/**
 * Pojedinačni Toast komponenta sa animacijom
 */
const Toast = ({ id, message, type, onHide, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const config = getToastConfig(type);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.backgroundColor },
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
          top: 50 + index * 70,
        },
      ]}
    >
      <Ionicons name={config.icon} size={22} color="#fff" style={styles.icon} />
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity onPress={onHide} style={styles.closeButton}>
        <Ionicons name="close" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Konfiguracija boja i ikona za različite tipove toast-a
 */
function getToastConfig(type) {
  switch (type) {
    case "success":
      return {
        backgroundColor: "#22c55e",
        icon: "checkmark-circle",
      };
    case "warning":
      return {
        backgroundColor: "#f59e0b",
        icon: "warning",
      };
    case "info":
      return {
        backgroundColor: "#3b82f6",
        icon: "information-circle",
      };
    case "error":
    default:
      return {
        backgroundColor: "#ef4444",
        icon: "alert-circle",
      };
  }
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    alignItems: "center",
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default ToastContext;
