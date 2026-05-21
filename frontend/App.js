// App.js
import React from "react";
import { AuthProvider } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppNavigator from "./navigation/AppNavigator";
import { enableScreens } from "react-native-screens";

enableScreens(false);

const App = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <NetworkProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </NetworkProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
