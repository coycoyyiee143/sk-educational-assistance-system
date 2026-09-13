import axios from "axios";

// Shared derivation of the storage URL (for images/uploads) so every
// component builds it the same way instead of each having its own
// separate localhost fallback. Import this wherever you need it:
//   import api, { STORAGE_URL } from "../../services/api";
const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
export const STORAGE_URL = `${apiUrl.replace(/\/api\/?$/, "")}/storage/`;

const api = axios.create({
    baseURL: apiUrl,
    headers: {
        Accept: "application/json",
    },
});

// Attach token to every request if it exists
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // If sending FormData, delete Content-Type so browser sets it with boundary
    if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
    }

    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            // Also clear the per-session privacy notice flag, so the
            // Data Privacy Notice shows again on the next login — this
            // path bypasses AuthContext's logout(), so it has to repeat
            // that cleanup itself instead of relying on it.
            sessionStorage.removeItem("privacyNoticeShown");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

window.addEventListener("storage", (e) => {
    if (e.key === "token" && e.newValue === null) {
        sessionStorage.removeItem("privacyNoticeShown");
        window.location.href = "/login";
    }
});

export default api;