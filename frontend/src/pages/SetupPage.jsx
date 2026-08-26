import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const inputCls =
  "w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-gray-400 transition";

export default function SetupPage() {
  const { requestSetupOtp, verifySetupOtp } = useAuth();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState("details"); // "details" | "verify"
  const [channel, setChannel] = useState("email");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm: "",
  });

  const [otpInfo, setOtpInfo] = useState(null); // { otp_id, destination_masked, dev_otp, ... }
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  // Only allow setup when no admin exists yet
  useEffect(() => {
    let active = true;
    api
      .get("/auth/setup-status")
      .then(({ data }) => {
        if (!active) return;
        if (!data.setup_required) navigate("/login", { replace: true });
        else setChecking(false);
      })
      .catch(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [navigate]);

  // Countdown for expiry
  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [secondsLeft]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const parseErr = (err, fallback) => {
    const detail = err.response?.data?.detail;
    return Array.isArray(detail) ? detail.map((d) => d.msg).join(" ") : detail || fallback;
  };

  const sendOtp = async () => {
    setError("");
    const destination = channel === "email" ? form.email.trim() : form.phone_number.trim();
    if (!destination) {
      setError(channel === "email" ? "Enter your email address." : "Enter your phone number.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestSetupOtp({
        name: form.name.trim(),
        password: form.password,
        channel,
        destination,
      });
      setOtpInfo(data);
      setSecondsLeft(data.expires_in_seconds || 600);
      setCode("");
      setStep("verify");
    } catch (err) {
      setError(parseErr(err, "Could not send the verification code."));
    } finally {
      setBusy(false);
    }
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    sendOtp();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const user = await verifySetupOtp(otpInfo.otp_id, code.trim());
      navigate(user.role === "admin" ? "/admin" : "/tech", { replace: true });
    } catch (err) {
      setError(parseErr(err, "Verification failed."));
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">ServiceSync</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Smart Repair Shop Management System</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {step === "details" ? (
            <>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Welcome — Let's get started</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
                Create the owner / administrator account. We'll verify your{" "}
                {channel === "email" ? "email" : "phone number"} with a one-time code.
              </p>

              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Full Name</label>
                  <input name="name" required autoFocus value={form.name} onChange={handleChange}
                    placeholder="e.g. Kasun Perera" className={inputCls} />
                </div>

                {/* Channel toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Verify using</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {[
                      { v: "email", label: "Email" },
                      { v: "phone", label: "Phone (SMS)" },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => { setChannel(opt.v); setError(""); }}
                        className={`py-2 rounded-md text-sm font-medium transition-colors ${
                          channel === opt.v ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {channel === "email" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Email Address</label>
                    <input name="email" type="email" required value={form.email} onChange={handleChange}
                      placeholder="owner@example.com" className={inputCls} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Phone Number</label>
                    <input name="phone_number" required value={form.phone_number} onChange={handleChange}
                      placeholder="07XXXXXXXX or +94XXXXXXXXX" className={inputCls} />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Password</label>
                  <input name="password" type="password" required value={form.password} onChange={handleChange}
                    placeholder="At least 6 characters" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Confirm Password</label>
                  <input name="confirm" type="password" required value={form.confirm} onChange={handleChange}
                    placeholder="Re-enter password" className={inputCls} />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={busy}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                  {busy ? "Sending code…" : "Send Verification Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setStep("details"); setError(""); }}
                className="text-sm text-blue-500 hover:underline mb-3">
                ← Back
              </button>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Enter verification code</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
                We sent a 6-digit code to <strong className="text-gray-700 dark:text-gray-200">{otpInfo?.destination_masked}</strong>.
              </p>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">6-Digit Code</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="••••••"
                    className={`${inputCls} text-center text-lg tracking-[0.5em] font-semibold`}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    {secondsLeft > 0
                      ? `Code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                      : "Code expired — please resend."}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={busy}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                  {busy ? "Verifying…" : "Verify & Create Account"}
                </button>

                <button type="button" disabled={busy} onClick={sendOtp}
                  className="w-full text-blue-500 hover:underline text-sm">
                  Resend code
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
