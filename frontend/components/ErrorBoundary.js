// components/ErrorBoundary.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Error Boundary komponenta koja hvata JavaScript greške u child komponentama
 * i prikazuje fallback UI umjesto da aplikacija pukne.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Ažuriraj state tako da sljedeći renderovanje prikaže fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Loguj grešku (možeš dodati slanje na backend/analytics servis)
    console.error("ErrorBoundary uhvatio grešku:", error);
    console.error("Component stack:", errorInfo?.componentStack);
    
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="warning-outline" size={80} color="#e74c3c" />
            
            <Text style={styles.title}>Ups! Nešto je pošlo po zlu</Text>
            
            <Text style={styles.message}>
              Došlo je do neočekivane greške. Molimo pokušajte ponovo.
            </Text>

            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.retryButtonText}>Pokušaj ponovo</Text>
            </TouchableOpacity>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Detalji greške (dev mode):</Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    alignItems: "center",
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: "row",
    backgroundColor: "#10345bff",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorDetails: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    maxHeight: 200,
    width: "100%",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#991b1b",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    fontFamily: "monospace",
  },
  stackText: {
    fontSize: 10,
    color: "#7f1d1d",
    fontFamily: "monospace",
    marginTop: 10,
  },
});

export default ErrorBoundary;
