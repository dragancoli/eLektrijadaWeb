import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * TimelineList - vertikalna timeline lista za nadolazeće događaje (mečeve, termine).
 *
 * Props:
 *   data: [{ title: string, subtitle?: string, date: string, location?: string, badge?: string }]
 *   title?: string
 *   accentColor?: string
 */
const TimelineList = ({ data = [], title, accentColor = "#10345bff" }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={40} color="#ccc" />
          <Text style={styles.emptyText}>Nema nadolazećih događaja</Text>
        </View>
      </View>
    );
  }

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("sr-Latn-BA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {data.map((item, i) => (
        <View key={i} style={styles.row}>
          {/* Timeline line */}
          <View style={styles.lineWrap}>
            <View style={[styles.dot, { backgroundColor: accentColor }]} />
            {i < data.length - 1 && <View style={[styles.line, { backgroundColor: accentColor + "30" }]} />}
          </View>
          {/* Content */}
          <View style={styles.card}>
            {item.badge && (
              <View style={[styles.badge, { backgroundColor: accentColor + "18" }]}>
                <Text style={[styles.badgeText, { color: accentColor }]}>{item.badge}</Text>
              </View>
            )}
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.subtitle && <Text style={styles.itemSubtitle}>{item.subtitle}</Text>}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color="#888" />
              <Text style={styles.metaText}>{formatDate(item.date)}</Text>
            </View>
            {item.location && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color="#888" />
                <Text style={styles.metaText}>{item.location}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    marginBottom: 0,
  },
  lineWrap: {
    width: 24,
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  card: {
    flex: 1,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
    marginLeft: 8,
    marginBottom: 10,
    borderLeftWidth: 0,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#888",
    marginLeft: 4,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: "#aaa",
  },
});

export default TimelineList;
