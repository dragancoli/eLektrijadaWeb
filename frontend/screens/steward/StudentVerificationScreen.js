import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Platform, ScrollView, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const PRIMARY = "#10345bff"; // Dark blue from AuthProfileScreen
const ACCENT = "#fa8d10ff"; // Orange from HomeScreen

const showAlert = (title, message) => {
	if (Platform.OS === "web") {
		window.alert(`${title}\n\n${message || ""}`);
	} else {
		Alert.alert(title, message);
	}
};

const StudentVerificationScreen = () => {
	const { user } = useAuth();
	const [permission, requestPermission] = useCameraPermissions();

	const [competitions, setCompetitions] = useState([]);
	const [loadingCompetitions, setLoadingCompetitions] = useState(true);
	const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);

	const [scannerVisible, setScannerVisible] = useState(false);
	const [scanned, setScanned] = useState(false);

	const [verifying, setVerifying] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchCompetitions = async () => {
			setLoadingCompetitions(true);
			try {
				const res = await apiClient.get("/stewards/science-competitions", {
					headers: { Authorization: `Bearer ${user?.token}` },
				});
				setCompetitions(res.data || []);
				if ((res.data || []).length > 0) {
					setSelectedCompetitionId(res.data[0].IdScienceCompetition);
				}
			} catch (e) {
				console.error("Failed to fetch competitions", e.response?.data || e.message);
				setError(e.response?.data?.message || "Greška prilikom učitavanja takmičenja.");
			} finally {
				setLoadingCompetitions(false);
			}
		};
		fetchCompetitions();
	}, [user?.token]);

	const selectedCompetition = useMemo(
		() => competitions.find((c) => c.IdScienceCompetition === selectedCompetitionId) || null,
		[competitions, selectedCompetitionId]
	);

	const openScanner = async () => {
		setError(null);
		setResult(null);
		setScanned(false);
		if (!permission?.granted) {
			const { granted } = await requestPermission();
			if (!granted) return;
		}
		setScannerVisible(true);
	};

	const verifyStudent = async (qrSecret) => {
		if (!selectedCompetitionId) return;
		setVerifying(true);
		setError(null);
		setResult(null);
		try {
			const res = await apiClient.post(
				"/stewards/verify-student",
				{ qrSecret, competitionId: selectedCompetitionId },
				{ headers: { Authorization: `Bearer ${user?.token}` } }
			);
			setResult(res.data);
		} catch (e) {
			console.error("Verification failed", e.response?.data || e.message);
			setError(e.response?.data?.message || "Greška prilikom verifikacije.");
		} finally {
			setVerifying(false);
		}
	};

	const confirmAttendance = async () => {
		if (!result?.student?.IdUser || !selectedCompetitionId) return;

		setConfirming(true);
		try {
			await apiClient.post(
				"/stewards/confirm-attendance",
				{ userId: result.student.IdUser, competitionId: selectedCompetitionId },
				{ headers: { Authorization: `Bearer ${user?.token}` } }
			);
			setResult((prev) => ({ ...prev, verified: true }));
			showAlert("Uspjeh", "Student je verifikovan kao prisutan.");
		} catch (e) {
			console.error("Confirmation failed", e.response?.data || e.message);
			showAlert("Greška", e.response?.data?.message || "Došlo je do greške prilikom potvrde.");
		} finally {
			setConfirming(false);
		}
	};

	const onBarCodeScanned = ({ data }) => {
		if (scanned) return;
		setScanned(true);
		setScannerVisible(false);
		verifyStudent(String(data));
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
			<Text style={styles.title}>Verifikacija takmičara</Text>

			<View style={styles.card}>
				<Text style={styles.sectionTitle}>Odaberi takmičenje</Text>
				{loadingCompetitions ? (
					<ActivityIndicator color={PRIMARY} />
				) : competitions.length === 0 ? (
					<Text style={styles.muted}>Nema dostupnih naučnih takmičenja.</Text>
				) : (
					<View style={styles.pickerWrapper}>
						<Picker
							selectedValue={selectedCompetitionId}
							onValueChange={(value) => setSelectedCompetitionId(value)}
							style={styles.picker}
							dropdownIconColor="#333"
						>
							{competitions.map((c) => (
								<Picker.Item
									key={c.IdScienceCompetition}
									label={`${c.ScienceName} • ${c.Year}${c.Location ? " • " + c.Location : ""}`}
									value={c.IdScienceCompetition}
									color="#333"
								/>
							))}
						</Picker>
					</View>
				)}

				{selectedCompetition && (
					<View style={styles.metaRow}>
						<Text style={styles.metaLabel}>Mjesto:</Text>
						<Text style={styles.metaValue}>{selectedCompetition.Location || "-"}</Text>
					</View>
				)}
			</View>

		<View style={styles.card}>
			<Text style={styles.sectionTitle}>Skeniranje QR koda</Text>
			{permission?.granted === false && (
				<Text style={styles.errorText}>Kamera nije dozvoljena. Dozvolite pristup u postavkama.</Text>
			)}
			<TouchableOpacity style={styles.primaryButton} onPress={openScanner} disabled={!selectedCompetitionId}>
				<Text style={styles.primaryButtonText}>Otvori kameru</Text>
			</TouchableOpacity>
			<Text style={styles.helpText}>Student mora da pokaze QR kod iz svog profila (QRCode).</Text>
		</View>

		<View style={styles.card}>
				<Text style={styles.sectionTitle}>Rezultat</Text>
				{verifying && <ActivityIndicator color={PRIMARY} />}
				{error && <Text style={styles.errorText}>{error}</Text>}
				{result && (
					<View>
						<View
							style={[styles.badge, result.belongs ? styles.badgeOk : styles.badgeErr]}
						>
							<Text style={[styles.badgeText, result.belongs ? styles.badgeTextOk : styles.badgeTextErr]}>
								{result.belongs ? "Takmičar pripada ovom takmičenju" : "Takmičar ne pripada ovom takmičenju"}
							</Text>
						</View>

						{result.student && (
							<View style={styles.infoBlock}>
								<Text style={styles.infoLine}>
									<Text style={styles.infoLabel}>Ime i prezime: </Text>
									{result.student.Name} {result.student.Lastname}
								</Text>
								<Text style={styles.infoLine}>
									<Text style={styles.infoLabel}>Email: </Text>
									{result.student.Email}
								</Text>
								<Text style={styles.infoLine}>
									<Text style={styles.infoLabel}>Fakultet: </Text>
									{result.student.FacultyName}
								</Text>
								{result.team && (
									<Text style={styles.infoLine}>
										<Text style={styles.infoLabel}>Tim: </Text>
										{result.team.Name}
									</Text>
								)}
								{result.verified !== null && (
									<Text style={styles.infoLine}>
										<Text style={styles.infoLabel}>Status verifikacije: </Text>
										{result.verified ? "Verifikovan" : "Nije verifikovan"}
									</Text>
								)}
							</View>
						)}

						{result.belongs && !result.verified && (
							<TouchableOpacity
								style={[styles.primaryButton, { backgroundColor: "#4CAF50", marginTop: 20 }]}
								onPress={confirmAttendance}
								disabled={confirming}
							>
								{confirming ? (
									<ActivityIndicator color="#fff" />
								) : (
									<Text style={styles.primaryButtonText}>Potvrdi prisustvo</Text>
								)}
							</TouchableOpacity>
						)}

						<View style={styles.actionsRow}>
							<TouchableOpacity style={styles.secondaryButton} onPress={() => setResult(null)}>
								<Text style={styles.secondaryButtonText}>Očisti</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}
			</View>

		{/* Scanner modal */}
		<Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
			<View style={styles.scannerContainer}>
				<View style={styles.scannerHeader}>
					<Text style={styles.scannerTitle}>Skeniranje QR koda</Text>
					<TouchableOpacity onPress={() => setScannerVisible(false)}>
						<Text style={styles.cancelText}>Zatvori</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.scannerBox}>
					<CameraView
						style={StyleSheet.absoluteFillObject}
						facing="back"
						barcodeScannerSettings={{
							barcodeTypes: ["qr"],
						}}
						onBarcodeScanned={scanned ? undefined : onBarCodeScanned}
					/>
				</View>
				<Text style={styles.scannerHint}>
					Poravnajte QR kod unutar okvira za automatsko očitavanje.
				</Text>
			</View>
		</Modal>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5"},
	title: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 20 },
	card: {
		backgroundColor: "#fff",
		borderRadius: 15,
		padding: 20,
		marginBottom: 15,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	sectionTitle: { color: "#333", fontSize: 18, fontWeight: "600", marginBottom: 12 },
	muted: { color: "#666" },
	pickerWrapper: {
		backgroundColor: "#f9f9f9",
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#e0e0e0",
		overflow: "hidden",
	},
	picker: { color: "#333" },
	metaRow: { flexDirection: "row", marginTop: 12 },
	metaLabel: { color: "#666", marginRight: 6, fontWeight: "500" },
	metaValue: { color: "#333", fontWeight: "600" },

	primaryButton: {
		marginTop: 12,
		backgroundColor: PRIMARY,
		borderRadius: 10,
		paddingVertical: 14,
		paddingHorizontal: 16,
		alignItems: "center",
	},
	primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
	helpText: { color: "#666", marginTop: 10, fontSize: 14 },
	errorText: { color: "#FF3B30", marginBottom: 10 },

	badge: {
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 8,
		marginBottom: 15,
		borderWidth: 1,
	},
	badgeOk: { backgroundColor: "#E8F5E9", borderColor: "#4CAF50" },
	badgeErr: { backgroundColor: "#FFEBEE", borderColor: "#EF5350" },
	badgeText: { fontWeight: "700", textAlign: "center" },
	badgeTextOk: { color: "#2E7D32" },
	badgeTextErr: { color: "#C62828" },

	infoBlock: { marginTop: 6 },
	infoLine: { color: "#333", marginTop: 6, fontSize: 15 },
	infoLabel: { color: "#666", fontWeight: "500" },

	actionsRow: { flexDirection: "row", marginTop: 20, gap: 10 },
	secondaryButton: {
		flex: 1,
		backgroundColor: "#fff",
		borderRadius: 10,
		paddingVertical: 12,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#e0e0e0",
	},
	secondaryButtonText: { color: "#333", fontWeight: "600" },

	scannerContainer: { flex: 1, backgroundColor: "#000" },
	scannerHeader: {
		paddingTop: Platform.OS === "ios" ? 56 : 24,
		paddingHorizontal: 16,
		paddingBottom: 12,
		backgroundColor: "#000",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	scannerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
	cancelText: { color: ACCENT, fontWeight: "700" },
	scannerBox: {
		flex: 1,
		margin: 16,
		borderRadius: 12,
		overflow: "hidden",
		borderWidth: 2,
		borderColor: ACCENT,
		backgroundColor: "#111",
	},
	scannerHint: { color: "#aaa", textAlign: "center", marginBottom: 24 },
});

export default StudentVerificationScreen;

