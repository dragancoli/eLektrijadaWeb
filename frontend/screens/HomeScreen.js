// screens/HomeScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform, 
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85;

const KATEGORIJE = ["Sve", "Vazno", "Sport", "Nauka", "Zabava"];

const HomeScreen = ({ navigation, route }) => { 
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKategorija, setSelectedKategorija] = useState("Sve");
  const [latestNews, setLatestNews] = useState([]);
  const [allNews, setAllNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef(null);

  const webSearchText = route?.params?.webSearchText;

  useEffect(() => {
    if (Platform.OS === "web" && webSearchText !== undefined) {
      setSearchQuery(webSearchText);
    }
  }, [webSearchText]);

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLatestNews(), fetchAllNews()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLatestNews();
  }, []);

  useEffect(() => {
    fetchAllNews();
  }, [selectedKategorija, searchQuery]);

  const fetchLatestNews = async () => {
    try {
      const response = await apiClient.get("/news/latest");
      const mappedData = response.data.map((item) => ({
        id: item.IdNews,
        naslov: item.Title,
        sadrzaj: item.Content,
        kategorija: item.Category,
        slika_url: item.PictureUrl,
        vazno: item.Important,
        datum_objave: item.CreatedAt,
      }));
      setLatestNews(mappedData);
    } catch (error) {
      console.error("Error fetching latest news:", error);
    }
  };

  const fetchAllNews = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (selectedKategorija !== "Sve") {
        params.kategorija = selectedKategorija;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await apiClient.get("/news/filter", { params });
      const mappedData = response.data.map((item) => ({
        id: item.IdNews,
        naslov: item.Title,
        sadrzaj: item.Content,
        kategorija: item.Category,
        slika_url: item.PictureUrl,
        vazno: item.Important,
        datum_objave: item.CreatedAt,
      }));
      setAllNews(mappedData);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("sr-Latn-BA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const renderLatestNewsCard = ({ item }) => (
    <TouchableOpacity
      style={styles.carouselCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate("NewsDetail", { newsItem: item })}
    >
      <Image source={{ uri: item.slika_url }} style={styles.carouselImage} />
      <View style={styles.carouselContent}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.kategorija}</Text>
        </View>
        <Text style={styles.carouselTitle} numberOfLines={2}>
          {item.naslov}
        </Text>
        <Text style={styles.carouselDate}>{formatDate(item.datum_objave)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderNewsItem = ({ item }) => (
    <TouchableOpacity
      style={styles.newsCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate("NewsDetail", { newsItem: item })}
    >
      <Image source={{ uri: item.slika_url }} style={styles.newsImage} />
      <View style={styles.newsContent}>
        <View style={styles.newsHeader}>
          <View style={styles.categoryBadgeSmall}>
            <Text style={styles.categoryBadgeTextSmall}>{item.kategorija}</Text>
          </View>
          {item.vazno && (
            <View style={styles.importantBadge}>
              <Ionicons name="star" size={8} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.newsTitle} numberOfLines={2}>
          {item.naslov}
        </Text>
        <Text style={styles.newsExcerpt} numberOfLines={2}>
          {item.sadrzaj}
        </Text>
        <Text style={styles.newsDate}>{formatDate(item.datum_objave)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Pretražite..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10345bff"]}
            tintColor="#10345bff"
          />
        }
      >
        {/* Latest News Carousel */}
        {!searchQuery && (
          <View style={styles.carouselContainer}>
            <Text style={styles.sectionTitle}>Najnovije:</Text>
            <FlatList
              ref={scrollViewRef}
              data={latestNews}
              renderItem={renderLatestNewsCard}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 15}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
            />
          </View>
        )}

        {/* Category Filter */}
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {KATEGORIJE.map((kat) => (
              <TouchableOpacity
                key={kat}
                style={[styles.categoryButton, selectedKategorija === kat && styles.categoryButtonActive]}
                onPress={() => setSelectedKategorija(kat)}
              >
                <Text
                  style={[styles.categoryButtonText, selectedKategorija === kat && styles.categoryButtonTextActive]}
                >
                  {kat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* News List */}
        <View style={styles.newsListContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#10345bff" style={{ marginTop: 30 }} />
          ) : allNews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>Nema dostupnih novosti</Text>
            </View>
          ) : (
            <FlatList
              data={allNews}
              renderItem={renderNewsItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    outlineStyle: "none",
  },
  carouselContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 15,
    marginBottom: 15,
    color: "#333",
  },
  carouselContent: {
    paddingLeft: 15,
  },
  carouselCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 15,
    marginRight: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  carouselImage: {
    width: "100%",
    height: 200,
  },
  carouselContent: {
    padding: 15,
  },
  categoryBadge: {
    backgroundColor: "#fa8d10ff",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  categoryBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  carouselTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  carouselDate: {
    fontSize: 12,
    color: "#999",
  },
  categoryContainer: {
    marginBottom: 20,
    paddingLeft: 15,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  categoryButtonActive: {
    backgroundColor: "#10345bff",
    borderColor: "#10345bff",
  },
  categoryButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  categoryButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  newsListContainer: {
    paddingHorizontal: 15,
    paddingBottom: 75,
  },
  newsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  newsImage: {
    width: 120,
    height: 120,
  },
  newsContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  newsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  categoryBadgeSmall: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 2,
  },
  categoryBadgeTextSmall: {
    color: "#333",
    fontSize: 10,
    fontWeight: "600",
  },
  importantBadge: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: 10,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  newsExcerpt: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  newsDate: {
    fontSize: 10,
    color: "#999",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: "#999",
  },
});

export default HomeScreen;