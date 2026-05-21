// screens/FacultyRankingsScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";

const CATEGORY_OPTIONS = ["Sve", "Nauka"]; // Sport (uskoro)

const FacultyRankingsScreen = ({ route }) => {
  const initialCategory = route.params?.category || "Sve";
  const [category, setCategory] = useState(initialCategory);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFaculties();
  }, [category]);

  const fetchFaculties = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/rankings/faculties", { params: { category } });
      setFaculties(res.data);
    } catch (e) {
      console.error("Error loading faculties ranking:", e);
      setFaculties([]);
    } finally {
      setLoading(false);
    }
  };

  const renderFacultyRow = ({ item, index }) => (
    <View style={styles.rankRow}>
      <Text style={styles.rankPosition}>{index + 1}.</Text>
      <Text style={styles.rankFaculty}>{item.fakultet_naziv}</Text>
      <View style={styles.rankPoints}>
        <Ionicons name="trophy-outline" size={16} color="#10345bff" />
        <Text style={styles.rankPointsText}>{Number(item.ukupno_bodova).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Category selector (Sve / Nauka) */}
      <View style={styles.categories}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORY_OPTIONS.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catButton, category === cat && styles.catButtonActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
          {/* Sport placeholder */}
          <View style={[styles.catButton, { opacity: 0.5 }]}>
            <Text style={styles.catText}>Sport (uskoro)</Text>
          </View>
        </ScrollView>
      </View>

      {/* List */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="ribbon-outline" size={22} color="#007AFF" />
          <Text style={styles.cardTitle}>Generalni plasman fakulteta</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#10345bff" style={{ marginVertical: 20 }} />
        ) : faculties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="podium-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nema podataka za prikaz</Text>
          </View>
        ) : (
          <FlatList
            data={faculties}
            renderItem={renderFacultyRow}
            keyExtractor={(item) => item.fakultet_id.toString()}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  categories: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    elevation: 2,
  },
  catButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 18,
    backgroundColor: "#f2f2f2",
  },
  catButtonActive: {
    backgroundColor: "#10345bff",
  },
  catText: { color: "#333", fontWeight: "600" },
  catTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 12,
    padding: 12,
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cardTitle: { marginLeft: 8, fontSize: 16, fontWeight: "700", color: "#333" },
  emptyContainer: { alignItems: "center", paddingVertical: 24 },
  emptyText: { marginTop: 8, color: "#999" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  rankPosition: { width: 28, textAlign: "center", fontWeight: "700", color: "#333" },
  rankFaculty: { flex: 1, color: "#333", fontWeight: "600" },
  rankPoints: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,122,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rankPointsText: { marginLeft: 6, color: "#10345bff", fontWeight: "700" },
  separator: { height: 1, backgroundColor: "#f0f0f0" },
});

export default FacultyRankingsScreen;
