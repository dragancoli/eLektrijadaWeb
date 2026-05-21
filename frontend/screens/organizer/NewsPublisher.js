import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import * as ImagePicker from "expo-image-picker";
import { Picker } from '@react-native-picker/picker';

const NewsPublisher = () => {
  const { user } = useAuth();
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [isFormVisible, setIsFormVisible] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // Default vrijednost ili prazno
  const [category, setCategory] = useState(""); 
  const [important, setImportant] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadNews = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/news");
      setNewsList(response.data);
    } catch (error) {
      console.error("Greška pri učitavanju vesti:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNews();
    setRefreshing(false);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      showAlert("Greška", "Greška prilikom odabira slike.");
    }
  };

  const handleSubmit = async () => {
    if (!title || !content || !category) {
      showAlert("Greška", "Popunite sva obavezna polja (uključujući kategoriju).");
      return;
    }

    setSubmitting(true);

    try {
      let pictureUrlPayload = undefined;
      
      if (selectedImage === null) {
          pictureUrlPayload = null;
      } else if (selectedImage.startsWith("http")) {
          pictureUrlPayload = selectedImage;
      }

      const textPayload = {
        Title: title,
        Content: content,
        Category: category,
        Important: important,
        IdUser: user?.IdUser,
        PictureUrl: pictureUrlPayload,
      };

      let targetId = editingId;

      if (editingId) {
        await apiClient.put(`/news/${editingId}`, textPayload, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
      } else {
        const response = await apiClient.post("/news", textPayload, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        targetId = response.data.IdNews;
      }

      if (selectedImage && !selectedImage.startsWith("http")) {
        await uploadNewsImage(targetId, selectedImage);
      }

      showAlert("Uspjeh", editingId ? "Vijest ažurirana!" : "Vijest objavljena!");
      resetForm();
      loadNews();

    } catch (error) {
      console.error("Greška:", error);
      showAlert("Greška", "Došlo je do greške prilikom čuvanja vijesti.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadNewsImage = async (newsId, imageUri) => {
    try {
      const formData = new FormData();

      if (Platform.OS === "web") {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append("image", blob, "news_image.jpg");
      } else {
        formData.append("image", {
          uri: imageUri,
          name: "news_image.jpg",
          type: "image/jpeg",
        });
      }

      await apiClient.post(`/news/${newsId}/image`, formData, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          "Accept": "application/json",
        },
        transformRequest: (data) => data,
      });

    } catch (error) {
      console.error("Image upload failed:", error);
      showAlert("Info", "Vijest je sačuvana, ali upload slike nije uspio.");
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory(""); // Resetuje na default
    setImportant(false);
    setSelectedImage(null);
    setEditingId(null);
    setIsFormVisible(false); 
  };

  const handleAddNewPress = () => {
      resetForm(); 
      setIsFormVisible(true); 
  };

  const handleEdit = (item) => {
    setEditingId(item.IdNews);
    setTitle(item.Title);
    setContent(item.Content);
    setCategory(item.Category);
    setImportant(item.Important);
    setSelectedImage(item.PictureUrl);
    setIsFormVisible(true); 
  };

  const handleDelete = async (id) => {
    if (Platform.OS === 'web') {
        if (confirm("Obriši vijest?")) deleteNewsApi(id);
    } else {
        Alert.alert("Potvrda", "Obriši vijest?", [
            { text: "Otkaži", style: "cancel" },
            { text: "Obriši", style: "destructive", onPress: () => deleteNewsApi(id) },
        ]);
    }
  };

  const deleteNewsApi = async (id) => {
      try {
        await apiClient.delete(`/news/${id}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        loadNews();
      } catch (error) {
        showAlert("Greška", "Neuspješno brisanje.");
      }
  };

  const renderNewsItem = ({ item }) => (
    <View style={styles.newsCard}>
      {item.PictureUrl ? (
        <Image source={{ uri: item.PictureUrl }} style={styles.newsImage} />
      ) : (
        <View style={styles.noImage}>
          <Ionicons name="image-outline" size={30} color="#999" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.newsTitle}>{item.Title}</Text>
        <Text numberOfLines={2} style={styles.newsContent}>
          {item.Content}
        </Text>
        <Text style={styles.newsMeta}>
          {item.Category} • {new Date(item.CreatedAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconBtn}>
          <Ionicons name="create-outline" size={22} color="#1a73e8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.IdNews)} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={22} color="red" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !newsList.length)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10345bff" />
      </View>
    );

  return (
    <View style={styles.mainContainer}>
        {isFormVisible ? (
            <ScrollView contentContainerStyle={styles.scrollViewContainer}>
                <View style={styles.formHeaderRow}>
                    <Text style={styles.header}>
                        {editingId ? "Uredi vijest" : "Objavi novu vijest"}
                    </Text>
                    <TouchableOpacity onPress={resetForm} style={styles.closeFormBtn}>
                        <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>Naslov</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Unesite naslov vijesti..."
                    value={title}
                    onChangeText={setTitle}
                />
                
                <Text style={styles.label}>Sadržaj</Text>
                <TextInput
                    style={[styles.input, styles.textarea]}
                    placeholder="Unesite sadržaj vijesti..."
                    multiline
                    numberOfLines={5}
                    value={content}
                    onChangeText={setContent}
                />
                
                {/* 2. PICKER SELECTION - POPRAVLJEN ZA IOS */}
                <Text style={styles.label}>Kategorija</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={category}
                        onValueChange={(itemValue) => setCategory(itemValue)}
                        mode="dropdown"
                        style={styles.picker}
                        dropdownIconColor="#10345bff"
                        // OVO JE KLJUČNO ZA IOS:
                        itemStyle={{ fontSize: 16, height: 140 }}
                    >
                        <Picker.Item label="Odaberite kategoriju..." value="" enabled={false} color="#999" />
                        <Picker.Item label="Sport" value="Sport" />
                        <Picker.Item label="Nauka" value="Nauka" />
                        <Picker.Item label="Zabava" value="Zabava" />
                    </Picker>
                </View>

                <Text style={styles.label}>Slika</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                    <Ionicons name={selectedImage ? "sync-outline" : "cloud-upload-outline"} size={28} color="#10345bff" />
                    <Text style={styles.imagePickerText}>
                        {selectedImage ? "Promijeni sliku" : "Dodaj sliku"}
                    </Text>
                </TouchableOpacity>

                {selectedImage && (
                    <View style={styles.previewContainer}>
                        <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                        <TouchableOpacity 
                            style={styles.removeImageBtn} 
                            onPress={() => setSelectedImage(null)}
                        >
                            <Ionicons name="close-circle" size={24} color="red" />
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    onPress={() => setImportant(!important)}
                    style={styles.checkboxContainer}
                >
                    <View style={[styles.checkbox, important && styles.checkboxChecked]}>
                        {important && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>Označi ovu vijest kao važnu</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.submitText}>
                            {editingId ? "Sačuvaj izmjene" : "Objavi vijest"}
                        </Text>
                    )}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                    <Text style={styles.cancelText}>Otkaži</Text>
                </TouchableOpacity>
            </ScrollView>
        ) : (
            <View style={styles.listContainer}>
                <Text style={[styles.header, { marginHorizontal: 20, marginTop: 20 }]}>Objavljene vijesti</Text>
                {newsList.length === 0 ? (
                    <Text style={styles.emptyText}>Nema objavljenih vijesti.</Text>
                ) : (
                    <FlatList
                    data={newsList}
                    keyExtractor={(item) => item.IdNews.toString()}
                    renderItem={renderNewsItem}
                    contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#10345bff"]}
                        tintColor="#10345bff"
                      />
                    }
                    />
                )}
                
                <TouchableOpacity style={styles.fab} onPress={handleAddNewPress}>
                    <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>
            </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollViewContainer: { padding: 20, paddingBottom: 120 },
  listContainer: { flex: 1, position: 'relative' },
  
  formHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  closeFormBtn: { padding: 5 },

  header: { fontSize: 22, fontWeight: "bold", color: "#10345bff" },
  label: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 5, marginTop: 10 },
  
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  textarea: { height: 120, textAlignVertical: "top" },

  // 3. STILOVI ZA PICKER (POPRAVLJENI ZA IOS)
  pickerContainer: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    marginBottom: 5,
    overflow: 'hidden',
    justifyContent: 'center',
    // Na iOS-u nam treba veća visina da bi wheel stao
    height: Platform.OS === 'ios' ? 150 : 55,
  },
  picker: {
    width: '100%',
    color: "#333",
    // Na iOS-u visina mora biti veća
    height: Platform.OS === 'ios' ? 150 : 55,
  },

  imagePickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f8f9fa",
      borderWidth: 2,
      borderColor: "#10345bff",
      borderStyle: "dashed",
      borderRadius: 12,
      padding: 20,
      marginTop: 5,
      marginBottom: 15,
  },
  imagePickerText: { marginLeft: 10, color: "#10345bff", fontWeight: "600", fontSize: 16 },
  
  previewContainer: { position: "relative", marginBottom: 20, alignItems: "center" },
  previewImage: { width: "100%", height: 200, borderRadius: 12, resizeMode: "cover" },
  removeImageBtn: { position: "absolute", top: 10, right: 10, backgroundColor: "white", borderRadius: 20, padding: 2 },

  checkboxContainer: { flexDirection: "row", alignItems: "center", marginVertical: 15 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#10345bff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    backgroundColor: "transparent",
  },
  checkboxChecked: { backgroundColor: "#10345bff" },
  checkboxLabel: { fontSize: 16, color: "#333" },
  
  submitBtn: {
    backgroundColor: "#10345bff",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnDisabled: { backgroundColor: "#889cb4" },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  
  cancelBtn: { 
    marginTop: 15, 
    alignItems: "center", 
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ff4d4d",
  },
  cancelText: { color: "#ff4d4d", fontWeight: "600", fontSize: 16 },

  newsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  newsImage: { width: 80, height: 80, borderRadius: 10, marginRight: 12, backgroundColor: "#f0f0f0" },
  noImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  newsTitle: { fontWeight: "bold", fontSize: 16, color: "#333", marginBottom: 4 },
  newsContent: { color: "#666", fontSize: 14, marginBottom: 6 },
  newsMeta: { fontSize: 12, color: "#999" },
  actions: { flexDirection: "row", marginLeft: 10 },
  iconBtn: { marginLeft: 12, padding: 4 },
  emptyText: { textAlign: "center", color: "#777", marginTop: 20 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center', 
    bottom: 90, 
    backgroundColor: '#10345bff', 
    borderRadius: 28,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    zIndex: 100,
  },
});

export default NewsPublisher;