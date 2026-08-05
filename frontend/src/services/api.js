import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach stored token on page load
const stored = localStorage.getItem("ss_token");
if (stored) {
  api.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
}

// Auto-redirect to /login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ss_token");
      localStorage.removeItem("ss_user");
      window.location.replace("/login");
    }
    return Promise.reject(err);
  }
);

export default api;
