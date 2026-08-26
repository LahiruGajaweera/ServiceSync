import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const inputCls =
  "w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-gray-400 transition";

export default function ForgotPasswordPage() {
  const { requestPasswordReset, verifyResetOtp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("identify"); // "identify" | "verify" | "newpass"
  const [identifier, setIdentifier] = useState("");
  const [otpInfo, setOtpInfo] = useState(null); // { otp_id, destination_masked, dev_otp, ... }
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  // Countdown for expiry
  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [secondsLeft]);

  const parseErr = (err, fallback) => {
    const detail = err.response?.data?.detail;
    return Array.isArray(detail) ? detail.map((d) => d.msg).join(" ") : detail || fallback;
  };

  const sendCode = async () => {
    setError("");
    if (!identifier.trim()) {
      setError("Enter your email or phone number.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestPasswordReset(identifier.trim());
      setOtpInfo(data);
      setSecondsLeft(data.expires_in_seconds || 600);
      setCode("");
      setNewPassword("");
      setConfirm("");
      setStep("verify");
    } catch (err) {
      setError(parseErr(err, "Could not send the verification code."));
    } finally {
      setBusy(false);
    }
  };

  const handleIdentifySubmit = (e) => {
    e.preventDefault();
    sendCode();
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
      await verifyResetOtp(otpInfo.otp_id, code.trim());
      setStep("newpass");
    } catch (err) {
      setError(parseErr(err, "The code could not be verified."));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(otpInfo.otp_id, code.trim(), newPassword);
      navigate("/login", { 
        replace: true, 
        state: { successMessage: "Password reset successfully! Please log in with your new password." } 
      });
    } catch (err) {
      setError(parseErr(err, "Password reset failed."));
      // If the code expired or maxed out between verify and submit, send the user back.
      if (err.response?.status === 400) setStep("verify");
    } finally {
      setBusy(false);
    }
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">ServiceSync</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Reset your password</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {step === "identify" && (
            <>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Forgot password?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Enter the email or phone number on your account and we'll send a verification code.
              </p>

              <form onSubmit={handleIdentifySubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                    Email or Phone
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or 07XXXXXXXX"
                    className={inputCls}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                             disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg
                             transition-colors text-sm"
                >
                  {busy ? "Sending…" : "Send verification code"}
                </button>
              </form>
            </>
          )}

          {step === "verify" && (
            <>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Enter the code</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">{otpInfo?.destination_masked}</span>.
              </p>

              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className={inputCls + " tracking-[0.5em] text-center font-semibold"}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    {secondsLeft > 0 ? `Code expires in ${fmtTime(secondsLeft)}` : "Code expired — resend a new one."}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                             disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg
                             transition-colors text-sm"
                >
                  {busy ? "Verifying…" : "Verify code"}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={sendCode}
                  className="w-full text-blue-600 hover:underline text-sm font-medium disabled:text-gray-400"
                >
                  Resend code
                </button>
              </form>
            </>
          )}

          {step === "newpass" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Code verified</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Set a new password for your account.</p>

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                    New password
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                             disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg
                             transition-colors text-sm"
                >
                  {busy ? "Resetting…" : "Reset password & sign in"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          <a href="/login" className="text-blue-500 hover:underline font-medium">
            ← Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
