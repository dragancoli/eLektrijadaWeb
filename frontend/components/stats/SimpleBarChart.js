import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * SimpleBarChart - horizontalni bar chart bez vanjskih biblioteka.
 * Props:
 *   data: [{ label: string, value: number }]
 *   title?: string
 *   barColor?: string
 *   showValues?: boolean
 */
const SimpleBarChart = ({
  data = [],
  title,
  barColor = "#10345bff",
  showValues = true,
  maxBarWidth,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.emptyText}>Nema podataka</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const barMaxWidth = maxBarWidth || SCREEN_WIDTH * 0.48;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {data.map((item, index) => {
        const pct = ((Number(item.value) || 0) / maxVal) * 100;
        return (
          <View key={index} style={styles.row}>
            <Text style={styles.label} numberOfLines={2}>
              {item.label}
            </Text>
            <View style={styles.barRow}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: item.color || barColor,
                      maxWidth: barMaxWidth,
                    },
                  ]}
                />
              </View>
              {showValues && (
                <Text style={styles.valueText}>
                  {Number(item.value).toLocaleString("sr")}
                </Text>
              )}
            </View>
          </View>
        );
      })}
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
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
    marginBottom: 4,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  barContainer: {
    flex: 1,
    height: 22,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    overflow: "hidden",
  },
  bar: {
    height: 22,
    borderRadius: 6,
    minWidth: 4,
  },
  valueText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
    minWidth: 40,
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default SimpleBarChart;
