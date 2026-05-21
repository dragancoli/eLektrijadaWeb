// context/NetworkContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";

const NetworkContext = createContext();

/**
 * Network Provider koji prati mrežni status i prikazuje banner kada nema konekcije
 */
export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerAnim] = useState(new Animated.Value(-60));

  useEffect(() => {
    // Pretplati se na promjene mrežnog statusa
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      const reachable = state.isInternetReachable ?? true;

      setIsConnected(connected);
      setIsInternetReachable(reachable);

      // Prikaži banner ako nema konekcije
      if (!connected || reachable === false) {
        setShowBanner(true);
        Animated.spring(bannerAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }).start();
      } else {
        // Sakrij banner sa animacijom
        Animated.timing(bannerAnim, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowBanner(false));
      }
    });

    // Inicijalna provjera
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    return () => unsubscribe();
  }, [bannerAnim]);

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable !== false;
  }, []);

  const value = {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable !== false,
    checkConnection,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
      {showBanner && (
        <Animated.View
          style={[
            styles.banner,
            { transform: [{ translateY: bannerAnim }] },
          ]}
        >
          <View style={styles.bannerContent}>
            <Ionicons name="cloud-offline" size={20} color="#fff" />
            <Text style={styles.bannerText}>
              {!isConnected
                ? "Nema internet konekcije"
                : "Konekcija je nestabilna"}
            </Text>
          </View>
        </Animated.View>
      )}
    </NetworkContext.Provider>
  );
};

/**
 * Hook za pristup mrežnom statusu
 */
export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork mora biti korišćen unutar NetworkProvider-a");
  }
  return context;
};

/**
 * Offline placeholder komponenta koja se može koristiti u ekranima
 */
export const OfflinePlaceholder = ({ onRetry }) => (
  <View style={styles.offlineContainer}>
    <Ionicons name="cloud-offline-outline" size={80} color="#9ca3af" />
    <Text style={styles.offlineTitle}>Nema internet konekcije</Text>
    <Text style={styles.offlineMessage}>
      Provjerite mrežne postavke i pokušajte ponovo.
    </Text>
    {onRetry && (
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.retryText}>Pokušaj ponovo</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ef4444",
    paddingTop: 40, // Za status bar
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#fff",
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#374151",
    marginTop: 20,
    marginBottom: 10,
  },
  offlineMessage: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 30,
  },
  retryButton: {
    flexDirection: "row",
    backgroundColor: "#10345bff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default NetworkContext;
