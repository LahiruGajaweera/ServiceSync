import { createContext, useCallback, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("ss_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (identifier, password) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    localStorage.setItem("ss_token", data.access_token);
    localStorage.setItem("ss_user", JSON.stringify(data.user));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setUser(data.user);
    return data.user;
  }, []);

  const setupAdmin = useCallback(async (payload) => {
    const { data } = await api.post("/auth/setup", payload);
    localStorage.setItem("ss_token", data.access_token);
    localStorage.setItem("ss_user", JSON.stringify(data.user));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setUser(data.user);
    return data.user;
  }, []);

  const requestSetupOtp = useCallback(async (payload) => {
    const { data } = await api.post("/auth/setup/request-otp", payload);
    return data;
  }, []);

  const verifySetupOtp = useCallback(async (otpId, code) => {
    const { data } = await api.post("/auth/setup/verify-otp", { otp_id: otpId, code });
    localStorage.setItem("ss_token", data.access_token);
    localStorage.setItem("ss_user", JSON.stringify(data.user));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setUser(data.user);
    return data.user;
  }, []);

  const requestPasswordReset = useCallback(async (identifier) => {
    const { data } = await api.post("/auth/forgot-password/request-otp", { identifier });
    return data;
  }, []);

  const verifyResetOtp = useCallback(async (otpId, code) => {
    const { data } = await api.post("/auth/forgot-password/verify-otp", { otp_id: otpId, code });
    return data;
  }, []);

  const resetPassword = useCallback(async (otpId, code, newPassword) => {
    const { data } = await api.post("/auth/forgot-password/reset", {
      otp_id: otpId,
      code,
      new_password: newPassword,
    });
    localStorage.setItem("ss_token", data.access_token);
    localStorage.setItem("ss_user", JSON.stringify(data.user));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setUser(data.user);
    return data.user;
  }, []);

  // Force-change a temporary password for the currently authenticated user.
  const updatePassword = useCallback(async (newPassword) => {
    const { data } = await api.post("/auth/update-password", { new_password: newPassword });
    localStorage.setItem("ss_token", data.access_token);
    localStorage.setItem("ss_user", JSON.stringify(data.user));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ss_token");
    localStorage.removeItem("ss_user");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    localStorage.setItem("ss_user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, setupAdmin, requestSetupOtp, verifySetupOtp, requestPasswordReset, verifyResetOtp, resetPassword, updatePassword, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
