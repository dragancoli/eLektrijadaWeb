import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * SimpleDonutChart - vizuelni krug/prstenasti dijagram bez vanjskih biblioteka.
 * Prikazuje segmente kao procenat pomoću conic-gradient ili fallback segmenata.
 *
 * Props:
 *   data: [{ label: string, value: number, color: string }]
 *   title?: string
 *   size?: number (veličina kruga, default 140)
 */
const SimpleDonutChart = ({ data = [], title, size = 140 }) => {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);

  if (!data.length || total === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.emptyText}>Nema podataka</Text>
      </View>
    );
  }

  const defaultColors = ["#10345bff", "#fa8d10ff", "#4CAF50", "#E91E63", "#9C27B0", "#00BCD4"];

  // Izračunaj procente
  const enriched = data.map((d, i) => ({
    ...d,
    pct: ((Number(d.value) || 0) / total) * 100,
    color: d.color || defaultColors[i % defaultColors.length],
  }));

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.chartRow}>
        {/* Donut krug */}
        <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
          {enriched.map((seg, i) => {
            // Kreiramo segmente koristeći border trick
            let cumBefore = 0;
            for (let j = 0; j < i; j++) cumBefore += enriched[j].pct;
            const rotation = (cumBefore / 100) * 360;
            const angle = (seg.pct / 100) * 360;

            if (angle <= 0) return null;

            return (
              <View
                key={i}
                style={[
                  styles.segment,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    transform: [{ rotate: `${rotation}deg` }],
                    borderTopColor: seg.color,
                    borderRightColor: angle > 90 ? seg.color : "transparent",
                    borderBottomColor: angle > 180 ? seg.color : "transparent",
                    borderLeftColor: angle > 270 ? seg.color : "transparent",
                    borderWidth: size * 0.15,
                  },
                ]}
              />
            );
          })}
          {/* Centar bijeli krug */}
          <View
            style={[
              styles.center,
              {
                width: size * 0.58,
                height: size * 0.58,
                borderRadius: size * 0.29,
              },
            ]}
          >
            <Text style={styles.totalValue}>{total}</Text>
            <Text style={styles.totalLabel}>Ukupno</Text>
          </View>
        </View>

        {/* Legenda */}
        <View style={styles.legend}>
          {enriched.map((seg, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <View style={styles.legendTextWrap}>
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {seg.label}
                </Text>
                <Text style={styles.legendValue}>
                  {seg.value} ({seg.pct.toFixed(0)}%)
                </Text>
              </View>
            </View>
          ))}
        </View>
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
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ring: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8e8e8",
    overflow: "hidden",
  },
  segment: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  center: {
    position: "absolute",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  totalLabel: {
    fontSize: 10,
    color: "#888",
    fontWeight: "500",
  },
  legend: {
    marginLeft: 18,
    flex: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendTextWrap: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 12,
    color: "#444",
    fontWeight: "500",
  },
  legendValue: {
    fontSize: 11,
    color: "#888",
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default SimpleDonutChart;
