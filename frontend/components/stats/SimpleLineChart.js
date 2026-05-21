import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * SimpleLineChart - line graph sa dijagonalnim linijama.
 * Koristi onLayout za tačne pixel kalkulacije i transform rotate za kose linije.
 *
 * Props:
 *   data: [{ label: string, value: number }]
 *   title?: string
 *   lineColor?: string
 *   height?: number
 *   showDots?: boolean
 *   showValues?: boolean
 */
const SimpleLineChart = ({
  data = [],
  title,
  lineColor = "#10345bff",
  height = 180,
  showDots = true,
  showValues = true,
}) => {
  const [chartWidth, setChartWidth] = useState(0);

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.emptyText}>Nema podataka</Text>
      </View>
    );
  }

  const values = data.map((d) => Number(d.value) || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const paddingTop = 28;
  const paddingBottom = 4;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartPadX = 24; // padding lijevo/desno da brojevi ne budu odsječeni
  const dotSize = 10;
  const lineThickness = 3;

  // Pixel pozicije tačaka (računa se tek kad znamo chartWidth)
  const points = chartWidth > 0
    ? data.map((d, i) => {
        const usableWidth = chartWidth - chartPadX * 2;
        const x = data.length > 1
          ? chartPadX + (i / (data.length - 1)) * usableWidth
          : chartWidth / 2;
        const y = paddingTop + (1 - ((Number(d.value) || 0) - minVal) / range) * chartHeight;
        return { x, y, value: Number(d.value) || 0, label: d.label };
      })
    : [];

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View
        style={[styles.chartArea, { height }]}
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      >
        {/* Grid lines */}
        <View style={[styles.gridLine, { top: paddingTop }]} />
        <View style={[styles.gridLine, { top: paddingTop + chartHeight / 2 }]} />
        <View style={[styles.gridLine, { top: paddingTop + chartHeight }]} />

        {/* Y-axis values */}
        <Text style={[styles.yLabel, { top: paddingTop - 7 }]}>{maxVal}</Text>
        <Text style={[styles.yLabel, { top: paddingTop + chartHeight / 2 - 7 }]}>
          {Math.round((maxVal + minVal) / 2)}
        </Text>
        <Text style={[styles.yLabel, { top: paddingTop + chartHeight - 7 }]}>{minVal}</Text>

        {chartWidth > 0 && (
          <>
            {/* Fill area pod linijom */}
            {points.map((p, i) => {
              if (i >= points.length - 1) return null;
              const next = points[i + 1];
              const left = p.x;
              const width = next.x - p.x;
              const topY = Math.min(p.y, next.y);
              const bottomY = paddingTop + chartHeight;

              return (
                <View key={`fill-${i}`} style={{
                  position: "absolute", left, width,
                  top: topY, height: bottomY - topY,
                  backgroundColor: lineColor + "12",
                }} />
              );
            })}

            {/* Dijagonalne linije između tačaka */}
            {points.map((p, i) => {
              if (i >= points.length - 1) return null;
              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={`line-${i}`}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y - lineThickness / 2,
                    width: length,
                    height: lineThickness,
                    backgroundColor: lineColor,
                    borderRadius: lineThickness / 2,
                    transformOrigin: "0% 50%",
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* Tačke */}
            {showDots && points.map((p, i) => (
              <View key={`dot-${i}`} style={{
                position: "absolute",
                left: p.x - dotSize / 2,
                top: p.y - dotSize / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: "#fff",
                borderWidth: 3,
                borderColor: lineColor,
                zIndex: 10,
              }} />
            ))}

            {/* Vrijednosti iznad tačaka */}
            {showValues && points.map((p, i) => (
              <Text key={`val-${i}`} style={{
                position: "absolute",
                left: p.x - 24,
                top: p.y - 22,
                width: 48,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "700",
                color: lineColor,
                zIndex: 11,
              }}>
                {p.value}
              </Text>
            ))}
          </>
        )}
      </View>

      {/* X-axis labels */}
      {chartWidth > 0 && (
        <View style={[styles.xAxisRow, { height: 24 }]}>
          {points.map((p, i) => (
            <Text
              key={`xlabel-${i}`}
              style={[styles.xLabel, {
                position: "absolute",
                left: p.x - 30,
                width: 60,
              }]}
              numberOfLines={1}
            >
              {p.label}
            </Text>
          ))}
        </View>
      )}
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
    marginBottom: 10,
  },
  chartArea: {
    position: "relative",
    marginLeft: 30,
    marginRight: 8,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  yLabel: {
    position: "absolute",
    left: -32,
    fontSize: 9,
    color: "#bbb",
    textAlign: "right",
    width: 28,
  },
  xAxisRow: {
    position: "relative",
    marginTop: 6,
    marginLeft: 30,
    marginRight: 8,
  },
  xLabel: {
    textAlign: "center",
    fontSize: 11,
    color: "#888",
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default SimpleLineChart;
