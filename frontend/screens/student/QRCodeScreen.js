// screens/QRCodeScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	ActivityIndicator,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert,
	Platform,
	RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";

const QRCodeScreen = () => {
	const { user } = useAuth();
	const [qrCodeUrl, setQrCodeUrl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const showError = (message) => {
		if (Platform.OS === "web") {
			window.alert(`Greška\n\n${message}`);
		} else {
			Alert.alert("Greška", message);
		}
	};

	const fetchQrCode = useCallback(async () => {
		if (!user?.token) {
			setError("Niste prijavljeni.");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const res = await apiClient.get("/account/qr-code", {
				headers: { Authorization: `Bearer ${user.token}` },
			});
			setQrCodeUrl(res.data.qrCodeUrl);
		} catch (e) {
			const msg = e?.response?.data?.error || e?.response?.data?.message || "Neuspješno učitavanje QR koda.";
			setError(msg);
			showError(msg);
		} finally {
			setLoading(false);
		}
	}, [user?.token]);

	useEffect(() => {
		fetchQrCode();
	}, [fetchQrCode]);

	const onRefresh = async () => {
		setRefreshing(true);
		await fetchQrCode();
		setRefreshing(false);
	};

	const retry = () => fetchQrCode();

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ paddingBottom: 60 }}
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
		>
			<View style={styles.card}>
				<Text style={styles.title}>QR Kod</Text>
				<Text style={styles.subtitle}>Vaš jedinstveni kod za verifikaciju</Text>

				{loading && (
					<View style={styles.centerBlock}>
						<ActivityIndicator size="large" color="#10345bff" />
						<Text style={styles.loadingText}>Učitavanje...</Text>
					</View>
				)}

				{!loading && error && (
					<View style={styles.centerBlock}>
						<Ionicons name="alert-circle-outline" size={54} color="#d9534f" />
						<Text style={styles.errorText}>{error}</Text>
						<TouchableOpacity style={styles.retryButton} onPress={retry}>
							<Text style={styles.retryButtonText}>Pokušaj ponovo</Text>
						</TouchableOpacity>
					</View>
				)}

				{!loading && !error && qrCodeUrl && (
					<View style={styles.centerBlock}>
						<Image
							source={{ uri: qrCodeUrl }}
							style={styles.qrImage}
							resizeMode="contain"
						/>
						<TouchableOpacity style={styles.refreshButton} onPress={fetchQrCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Ionicons name="refresh-outline" size={22} color="#fff" />
							<Text style={styles.refreshButtonText}>Osvježi</Text>
						</TouchableOpacity>
					</View>
				)}

				{!loading && !error && !qrCodeUrl && (
					<View style={styles.centerBlock}>
						<Text style={styles.infoText}>QR kod nije dostupan.</Text>
						<TouchableOpacity style={styles.retryButton} onPress={retry}>
							<Text style={styles.retryButtonText}>Pokušaj ponovo</Text>
						</TouchableOpacity>
					</View>
				)}
			</View>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f5f5f5" },
	card: {
		backgroundColor: "#fff",
		padding: 20,
		borderRadius: 15,
		margin: 20,
		paddingBottom: 30,
	},
	title: { fontSize: 24, fontWeight: "bold", marginBottom: 6, textAlign: "center", color: "#333" },
	subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
	centerBlock: { alignItems: "center", justifyContent: "center" },
	loadingText: { marginTop: 10, fontSize: 14, color: "#555" },
	errorText: { marginTop: 12, fontSize: 14, color: "#d9534f", textAlign: "center" },
	infoText: { marginTop: 8, fontSize: 14, color: "#555", textAlign: "center" },
	qrImage: {
		width: 220,
		height: 220,
		backgroundColor: "#fafafa",
		borderRadius: 12,
		padding: 12,
		marginBottom: 18,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 3,
	},
	refreshButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#10345bff",
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 25,
	},
	refreshButtonText: { color: "#fff", fontSize: 14, fontWeight: "600", marginLeft: 6 },
	retryButton: {
		marginTop: 16,
		backgroundColor: "#10345bff",
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 25,
	},
	retryButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});

export default QRCodeScreen;
