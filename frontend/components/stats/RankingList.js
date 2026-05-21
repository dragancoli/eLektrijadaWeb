import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * RankingList - rang lista sa medaljem za top 3 i progress bar.
 *
 * Props:
 *   data: [{ name: string, subtitle?: string, value: number | string, position?: number }]
 *   title?: string
 *   valueLabel?: string (npr. "bodova", "mečeva")
 *   showBar?: boolean
 */
const RankingList = ({ data = [], title, valueLabel = "", showBar = true }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyWrap}>
          <Ionicons name="podium-outline" size={40} color="#ccc" />
          <Text style={styles.emptyText}>Nema podataka za prikaz</Text>
        </View>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  const getMedal = (pos) => {
    if (pos === 1) return "🥇";
    if (pos === 2) return "🥈";
    if (pos === 3) return "🥉";
    return null;
  };

  const renderItem = ({ item, index }) => {
    const position = item.position ?? index + 1;
    const medal = getMedal(position);
    const pct = ((Number(item.value) || 0) / maxVal) * 100;

    return (
      <View style={styles.row}>
        <View style={styles.posWrap}>
          {medal ? (
            <Text style={styles.medal}>{medal}</Text>
          ) : (
            <Text style={styles.posText}>{position}</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
          {showBar && (
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(pct, 3)}%`,
                    backgroundColor: position <= 3 ? "#fa8d10ff" : "#10345bff",
                  },
                ]}
              />
            </View>
          )}
        </View>
        <Text style={styles.valueText}>
          {typeof item.value === "number" ? Number(item.value).toLocaleString("sr") : item.value}
          {valueLabel ? ` ${valueLabel}` : ""}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        scrollEnabled={false}
      />
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
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  posWrap: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  medal: {
    fontSize: 20,
  },
  posText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#888",
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
  },
  barBg: {
    height: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10345bff",
    minWidth: 50,
    textAlign: "right",
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

export default RankingList;
