// screens/NewsDetailScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const NewsDetailScreen = ({ route }) => {
  const { newsItem } = route.params;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("sr-Latn-BA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <Image source={{ uri: newsItem.slika_url }} style={styles.headerImage} />

        {/* Content Container */}
        <View style={styles.contentContainer}>
          {/* Category and Important Badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{newsItem.kategorija}</Text>
            </View>
            {newsItem.vazno && (
              <View style={styles.importantBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.importantBadgeText}>Važno</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{newsItem.naslov}</Text>

          {/* Date */}
          <Text style={styles.date}>{formatDate(newsItem.datum_objave)}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Content */}
          <Text style={styles.content}>{newsItem.sadrzaj}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    marginBottom: 75
  },
  headerImage: {
    width: width,
    height: 250,
    backgroundColor: "#e0e0e0",
  },
  contentContainer: {
    backgroundColor: "#fff",
    margin: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  categoryBadge: {
    backgroundColor: "#fa8d10ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
  },
  categoryBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  importantBadge: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  importantBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    lineHeight: 32,
  },
  date: {
    fontSize: 14,
    color: "#999",
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
});

export default NewsDetailScreen;
