import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import bgImage from "../modern_repair_bg.jpg";

const STEPS = [
  { key: "pending",           label: "Registered" },
  { key: "in_progress",       label: "Under Repair" },
  { key: "completed",         label: "Complete" },
  { key: "ready_for_pickup",  label: "Ready" },
  { key: "delivered",         label: "Delivered" },
];

function stepIndex(status) {
  return STEPS.findIndex((s) => s.key === status);
}

function ProgressBar({ status }) {
  const current = stepIndex(status);
  return (
    <div className="relative flex items-start justify-between mt-6 mb-2">
      {/* Background line */}
      <div className="absolute top-4 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 z-0"></div>
      
      {/* Active line */}
      <div 
        className="absolute top-4 left-0 h-1 bg-blue-500 z-0 transition-all duration-500"
        style={{ width: current > 0 ? `${(current / (STEPS.length - 1)) * 100}%` : '0%' }}
      ></div>

      {STEPS.map((step, idx) => {
        const isPast = idx < current;
        const isCurrent = idx === current;
        return (
          <div key={step.key} className="flex flex-col items-center z-10 w-20">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors duration-300
                ${isPast ? "bg-blue-600 text-white" : isCurrent ? "bg-blue-500 text-white ring-4 ring-blue-500/30" : "bg-white dark:bg-gray-800 text-gray-400 border border-gray-300 dark:border-gray-600"}`}
            >
              {isPast ? "✓" : (idx + 1)}
            </div>
            <span className={`text-[10px] sm:text-xs mt-2 font-medium text-center ${isCurrent || isPast ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackingPage() {
  const { jobId: paramId } = useParams();
  const navigate = useNavigate();
  const [jobId, setJobId] = useState(paramId || "");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault();
    const id = jobId.trim();
    if (!id) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await api.get(`/jobs/track/${id}`);
      setJob(data);
      navigate(`/track/${id}`, { replace: true });
    } catch (err) {
      setJob(null);
      setError(
        err.response?.status === 404
          ? `No repair job found with ID "${id}". Please check your receipt.`
          : "Could not fetch repair status. Please try again shortly."
      );
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s) => {
    const map = {
      pending:          "bg-yellow-100/90 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
      in_progress:      "bg-blue-100/90 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      completed:        "bg-green-100/90 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      ready_for_pickup: "bg-purple-100/90 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      delivered:        "bg-green-100/90 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      unclaimed:        "bg-red-100/90 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    };
    return map[s] ?? "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300";
  };

  return (
    <div 
      className="min-h-screen flex flex-col bg-cover bg-center bg-fixed bg-no-repeat relative text-gray-900 dark:text-gray-100"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Frosted overlay - optimized for contrast */}
      <div className="absolute inset-0 bg-white/40 dark:bg-gray-950/70 backdrop-blur-md z-0"></div>

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 relative z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight drop-shadow-sm">ServiceSync</span>
            <span className="ml-2 text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-200/50 dark:bg-gray-800/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-gray-300/30 dark:border-gray-600/30">Repair Tracker</span>
          </div>
          <a href="/login" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors drop-shadow-sm">
            Staff Login →
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12 relative z-10 w-full">
        {/* Search */}
        <div className="bg-white/90 dark:bg-gray-900/70 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-8 mb-8 transition-all">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Track Your Repair</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium">
            Enter the Job ID printed on your repair receipt
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="e.g. SS-A3F9C2E1"
              className="flex-1 px-5 py-3.5 bg-white dark:bg-gray-950/60 border border-gray-300 dark:border-gray-700/80 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:placeholder-gray-500 shadow-inner"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500/50 text-white shadow-lg shadow-blue-500/30
                         px-8 py-3.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? "…" : "Track"}
            </button>
          </form>

          {error && (
            <div className="mt-5 bg-red-50/90 dark:bg-red-900/30 backdrop-blur-sm border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-5 py-3.5 rounded-xl text-sm font-medium flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}
        </div>

        {/* Result card */}
        {job && (
          <div className="bg-white/90 dark:bg-gray-900/70 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Job header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Job ID</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{job.job_id}</p>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-sm border border-black/5 dark:border-white/10 ${statusBadge(job.status)}`}>
                {job.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm mb-8 bg-gray-50/50 dark:bg-gray-950/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/50">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Device</p>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-base">{job.device_brand} <span className="font-medium text-gray-600 dark:text-gray-300">{job.device_model}</span></p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Issue</p>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-base capitalize">
                  {job.fault_category?.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Received</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">
                  {new Date(job.received_date).toLocaleDateString("en-LK", { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              {job.estimated_completion_date && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Est. Ready By</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {new Date(job.estimated_completion_date).toLocaleDateString("en-LK", { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              )}
              {job.estimated_cost != null && (
                <div className="col-span-2 pt-4 mt-2 border-t border-gray-200 dark:border-gray-800/60">
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Estimated Cost</p>
                  <p className="font-black text-lg text-blue-600 dark:text-blue-400">
                    LKR {Number(job.estimated_cost).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="pt-2">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Repair Progress</p>
              <ProgressBar status={job.status} />
            </div>

            {job.status === "ready_for_pickup" && (
              <div className="mt-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 px-5 py-4 rounded-xl text-sm font-semibold shadow-sm flex items-start gap-3">
                <span className="text-xl leading-none">🎉</span>
                <div>
                  <p>Your device is ready for collection!</p>
                  <p className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80 mt-0.5">Please visit the shop at your earliest convenience.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
