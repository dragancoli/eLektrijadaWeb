import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * VerticalBarChart - vertikalni bar chart bez vanjskih biblioteka.
 *
 * Props:
 *   data: [{ label: string, value: number, color?: string }]
 *   title?: string
 *   barColor?: string
 *   height?: number
 *   showValues?: boolean
 */
const VerticalBarChart = ({
  data = [],
  title,
  barColor = "#10345bff",
  height = 200,
  showValues = true,
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
  // Dinamička širina bara prema broju stavki
  const availableWidth = SCREEN_WIDTH - 100;
  const barGap = 8;
  const barWidth = Math.min(44, Math.max(18, (availableWidth / data.length) - barGap));
  const labelWidth = barWidth + barGap + 8;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Chart + bars area */}
      <View style={[styles.chartArea, { height }]}>
        <View style={[styles.gridLine, { bottom: 0 }]} />
        <View style={[styles.gridLine, { bottom: height * 0.25 }]} />
        <View style={[styles.gridLine, { bottom: height * 0.5 }]} />
        <View style={[styles.gridLine, { bottom: height * 0.75 }]} />
        <View style={[styles.gridLine, { bottom: height }]} />

        <View style={styles.yAxis}>
          <Text style={styles.yLabel}>{maxVal.toLocaleString("sr")}</Text>
          <Text style={styles.yLabel}>{Math.round(maxVal * 0.75).toLocaleString("sr")}</Text>
          <Text style={styles.yLabel}>{Math.round(maxVal * 0.5).toLocaleString("sr")}</Text>
          <Text style={styles.yLabel}>{Math.round(maxVal * 0.25).toLocaleString("sr")}</Text>
          <Text style={styles.yLabel}>0</Text>
        </View>

        <View style={styles.barsRow}>
          {data.map((item, index) => {
            const pct = ((Number(item.value) || 0) / maxVal) * 100;
            const color = item.color || barColor;
            return (
              <View key={index} style={styles.barColumn}>
                <View style={[styles.barTrack, { height }]}>
                  {showValues && (
                    <Text style={[styles.valueText, { color }]}>
                      {Number(item.value).toLocaleString("sr")}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(pct, 1)}%`,
                        width: barWidth,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* X-axis labels - puni nazivi ispod barova */}
      <View style={styles.xAxisRow}>
        {data.map((item, index) => (
          <View key={index} style={[styles.xLabelWrap, { width: labelWidth }]}>
            <Text style={styles.xLabel} numberOfLines={4}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
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
  chartArea: {
    position: "relative",
    marginLeft: 36,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  yAxis: {
    position: "absolute",
    left: -38,
    top: -6,
    bottom: -6,
    justifyContent: "space-between",
    width: 34,
  },
  yLabel: {
    fontSize: 9,
    color: "#bbb",
    textAlign: "right",
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    height: "100%",
  },
  barColumn: {
    alignItems: "center",
  },
  barTrack: {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 2,
  },
  valueText: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 8,
    marginLeft: 36,
    paddingBottom: 4,
  },
  xLabelWrap: {
    alignItems: "center",
  },
  xLabel: {
    fontSize: 9,
    color: "#888",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default VerticalBarChart;
