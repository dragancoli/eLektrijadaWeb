// api/client.js
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import { showGlobalToast } from "../context/ToastContext";

const BASE_URL = "https://elektrijada-backend.onrender.com";

// Konfiguracija za retry mehanizam
const RETRY_CONFIG = {
  maxRetries: 1,        // Samo 1 retry (ukupno 2 pokušaja)
  retryDelay: 500,      // 0.5 sekundi delay
  retryableStatuses: [408, 500, 502, 503, 504], // Retry samo za gateway greške
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 8000, // 8 sekundi timeout (brže)
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Pomocna funkcija za delay
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Request interceptor - dodaje provjeru konekcije prije svakog zahtjeva
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Provjeri mrežnu konekciju
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        return Promise.reject({
          isNetworkError: true,
          message: "Nema internet konekcije. Provjerite mrežne postavke.",
        });
      }
    } catch (netError) {
      console.warn("NetInfo provjera nije uspjela:", netError);
      // Nastavi sa zahtjevom ako NetInfo ne radi
    }

    // Inicijalizuj retry brojač
    config.__retryCount = config.__retryCount || 0;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - rukuje greškama i retry logikom
 */
apiClient.interceptors.response.use(
  // Uspješan odgovor - samo proslijedi
  (response) => response,

  // Greška - obradi i eventualno ponovi zahtjev
  async (error) => {
    const config = error.config;

    // Ako je mrežna greška (već obrađena u request interceptoru)
    if (error.isNetworkError) {
      return Promise.reject(error);
    }

    // Provjeri da li je timeout ili mrežna greška
    const isNetworkError = !error.response;
    const isTimeoutError = error.code === "ECONNABORTED";
    const isRetryableStatus =
      error.response &&
      RETRY_CONFIG.retryableStatuses.includes(error.response.status);

    // Odluči da li treba ponoviti zahtjev
    const shouldRetry =
      config &&
      config.__retryCount < RETRY_CONFIG.maxRetries &&
      (isNetworkError || isTimeoutError || isRetryableStatus);

    if (shouldRetry) {
      config.__retryCount += 1;
      const retryDelay = RETRY_CONFIG.retryDelay * config.__retryCount;

      console.log(
        `Ponavljam zahtjev (${config.__retryCount}/${RETRY_CONFIG.maxRetries}) za ${config.url} za ${retryDelay}ms`
      );

      await delay(retryDelay);
      return apiClient(config);
    }

    // Formatiraj grešku za lakše rukovanje u komponentama
    const formattedError = {
      message: getErrorMessage(error),
      status: error.response?.status,
      data: error.response?.data,
      isNetworkError,
      isTimeoutError,
      originalError: error,
    };

    // Loguj grešku
    console.error("API Greška:", {
      url: config?.url,
      method: config?.method,
      status: formattedError.status,
      message: formattedError.message,
    });

    // Prikaži toast korisniku (osim za 401 koji se obrađuje posebno)
    if (formattedError.status !== 401) {
      showGlobalToast({
        message: formattedError.message,
        type: "error",
        duration: 4000,
      });
    }

    return Promise.reject(formattedError);
  }
);

/**
 * Pomocna funkcija za formatiranje poruke greške
 */
function getErrorMessage(error) {
  // Timeout
  if (error.code === "ECONNABORTED") {
    return "Zahtjev je istekao. Server ne odgovara.";
  }

  // Nema odgovora (mrežna greška)
  if (!error.response) {
    return "Nije moguće povezati se sa serverom. Provjerite internet konekciju.";
  }

  // HTTP status kodovi
  const status = error.response.status;
  const serverMessage = error.response.data?.message || error.response.data?.error;

  switch (status) {
    case 400:
      return serverMessage || "Neispravan zahtjev.";
    case 401:
      return serverMessage || "Pogrešni pristupni podaci.";
    case 403:
      return "Nemate dozvolu za ovu akciju.";
    case 404:
      return serverMessage || "Traženi resurs nije pronađen.";
    case 409:
      return serverMessage || "Konflikt podataka.";
    case 422:
      return serverMessage || "Podaci nisu validni.";
    case 429:
      return "Previše zahtjeva. Molimo sačekajte.";
    case 500:
      return "Greška na serveru. Pokušajte ponovo kasnije.";
    case 502:
    case 503:
    case 504:
      return "Server je privremeno nedostupan. Pokušajte ponovo.";
    default:
      return serverMessage || `Greška (${status}). Pokušajte ponovo.`;
  }
}

export default apiClient;
