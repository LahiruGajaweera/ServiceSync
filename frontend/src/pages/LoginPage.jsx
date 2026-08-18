import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import ChatbotWidget from "../components/ChatbotWidget";
import bgImage from "../repair-bg.png";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.successMessage || "");
  const [loading, setLoading] = useState(false);

  // If the system has no admin yet, send the owner to first-run setup
  useEffect(() => {
    let active = true;
    api
      .get("/auth/setup-status")
      .then(({ data }) => {
        if (active && data.setup_required) navigate("/setup", { replace: true });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [navigate]);

  // Force light theme for the landing/login page
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark');
    if (wasDark) {
      document.documentElement.classList.remove('dark');
    }
    return () => {
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const user = await login(form.identifier, form.password);
      if (user.is_temporary_password) {
        navigate("/set-password", { replace: true });
        return;
      }
      navigate(user.role === "admin" ? "/admin" : "/tech", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Dark frosted overlay to make the image visible while ensuring white text pops */}
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-0"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-lg">ServiceSync</h1>
          <p className="text-gray-200 mt-3 text-base font-medium drop-shadow-md bg-black/30 border border-white/10 inline-block px-5 py-1.5 rounded-full backdrop-blur-sm">Smart Repair Shop Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Staff Sign In</h2>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Email or Phone
              </label>
              <input
                type="text"
                required
                autoFocus
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder="you@example.com or 07XXXXXXXX"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-400 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-400 transition"
              />
              <div className="text-right mt-1.5">
                <a
                  href="/forgot-password"
                  className="text-xs text-blue-500 hover:underline font-medium"
                >
                  Forgot password?
                </a>
              </div>
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
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-200 font-medium bg-black/40 py-2 px-6 rounded-full inline-block shadow-lg border border-white/10 backdrop-blur-md">
            Customer?{" "}
            <a href="/track" className="text-blue-300 hover:text-white hover:underline font-bold ml-1 transition-colors">
              Track your repair →
            </a>
          </p>
        </div>
      </div>
      <ChatbotWidget />
    </div>
  );
}
