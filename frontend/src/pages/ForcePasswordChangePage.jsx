import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForcePasswordChangePage() {
  const { user, updatePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Only reachable while logged in and still on a temporary password.
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_temporary_password) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/tech"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    if (form.password !== form.confirm) {
      return setError("Passwords do not match.");
    }
    setLoading(true);
    try {
      const updated = await updatePassword(form.password);
      navigate(updated.role === "admin" ? "/admin" : "/tech", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail.map((d) => d.msg).join(" ") : detail || "Could not update password. Try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">ServiceSync</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Smart Repair Shop Management System</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Reset Your Password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
            Welcome, {user.name}. For security, please set a new password before continuing.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">New Password</label>
              <input
                type="password"
                required
                autoFocus
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-400 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Confirm Password</label>
              <input
                type="password"
                required
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-400 transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                         disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg
                         transition-colors text-sm"
            >
              {loading ? "Saving…" : "Set New Password"}
            </button>
          </form>

          <button
            onClick={() => { logout(); navigate("/login", { replace: true }); }}
            className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
