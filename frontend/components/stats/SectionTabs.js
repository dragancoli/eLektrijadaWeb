import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * SectionTabs - horizontalno skrolabilni tab dugmadi za biranje sekcije.
 *
 * Props:
 *   tabs: [{ key: string, label: string, icon?: string }]
 *   activeTab: string (key aktivnog taba)
 *   onTabChange: (key: string) => void
 *   accentColor?: string
 */
const SectionTabs = ({ tabs = [], activeTab, onTabChange, accentColor = "#10345bff" }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isActive && { backgroundColor: accentColor, borderColor: accentColor },
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            {tab.icon && (
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? "#fff" : "#666"}
                style={styles.icon}
              />
            )}
            <Text
              style={[styles.tabText, isActive && styles.tabTextActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
    maxHeight: 44,
  },
  content: {
    paddingRight: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#fff",
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    marginRight: 5,
  },
  tabText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default SectionTabs;
