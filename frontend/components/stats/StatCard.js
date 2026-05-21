import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const StatCard = ({ icon, label, value, color = "#10345bff", bgColor = "#fff", small = false }) => {
  return (
    <View style={[styles.card, { backgroundColor: bgColor }, small && styles.cardSmall]}>
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={small ? 20 : 26} color={color} />
      </View>
      <Text style={[styles.value, small && styles.valueSmall]} numberOfLines={1}>
        {value ?? "—"}
      </Text>
      <Text style={[styles.label, small && styles.labelSmall]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: "center",
  },
  cardSmall: {
    padding: 12,
    minWidth: 110,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  value: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  valueSmall: {
    fontSize: 20,
  },
  label: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    fontWeight: "500",
  },
  labelSmall: {
    fontSize: 11,
  },
});

export default StatCard;
