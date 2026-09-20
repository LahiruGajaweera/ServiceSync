import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import bgImage from "../modern_repair_bg.jpg";

const STEPS = [
  { key: "pending",           label: "Registered",   icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { key: "in_progress",       label: "Under Repair", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { key: "completed",         label: "Complete",     icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> },
  { key: "ready_for_pickup",  label: "Ready",        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
  { key: "delivered",         label: "Delivered",    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg> },
];

function stepIndex(status) {
  return STEPS.findIndex((s) => s.key === status);
}

function ProgressBar({ status }) {
  const current = stepIndex(status);
  return (
    <div className="relative flex items-start justify-between mt-8 mb-4">
      {/* Background line */}
      <div className="absolute top-5 left-0 w-full h-1.5 bg-gray-200 dark:bg-gray-700/60 z-0 rounded-full"></div>
      
      {/* Active line */}
      <div 
        className="absolute top-5 left-0 h-1.5 bg-gradient-to-r from-blue-500 to-blue-400 z-0 transition-all duration-1000 ease-in-out shadow-[0_0_10px_rgba(59,130,246,0.6)] rounded-full"
        style={{ width: current > 0 ? `${(current / (STEPS.length - 1)) * 100}%` : '0%' }}
      ></div>

      {STEPS.map((step, idx) => {
        const isPast = idx < current;
        const isCurrent = idx === current;
        return (
          <div key={step.key} className="flex flex-col items-center z-10 w-24 group">
            <div 
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-500
                ${isPast ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40" 
                : isCurrent ? "bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-4 ring-blue-500/20 scale-110" 
                : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-2 border-gray-200 dark:border-gray-700"}`}
            >
              {isCurrent && (
                <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20"></span>
              )}
              {isPast ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : step.icon}
            </div>
            <span className={`text-[10px] sm:text-xs mt-3 sm:mt-4 font-bold text-center transition-colors duration-300 ${isCurrent ? "text-blue-600 dark:text-blue-400" : isPast ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>
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

      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10 w-full">
        {/* Search */}
        <div className="bg-white/90 dark:bg-gray-900/70 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 mb-6 transition-all">
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
          <div className="relative group animate-in fade-in slide-in-from-bottom-4 duration-700 mt-8">
            {/* Animated glowing border effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
            
            <div className="relative bg-white/95 dark:bg-gray-900/90 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden">
              
              {/* Subtle background glow inside */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

              {/* Job header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 relative z-10">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Job ID</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">{job.job_id}</p>
                    {job.job_type === 'warranty' && (
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-purple-200/50 dark:border-purple-800/50 shadow-sm">
                        Warranty Claim
                      </span>
                    )}
                    {job.job_type === 'rework' && (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-amber-200/50 dark:border-amber-800/50 shadow-sm">
                        Paid Rework
                      </span>
                    )}
                  </div>
                </div>
                <span className={`px-5 py-2 rounded-xl text-xs font-bold tracking-widest shadow-sm border border-black/5 dark:border-white/10 backdrop-blur-md ${statusBadge(job.status)}`}>
                  {job.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-6 relative z-10">
                <div className="bg-gray-50/80 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm">
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Device</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-base">{job.device_brand} <span className="font-medium text-gray-500 dark:text-gray-400">{job.device_model}</span></p>
                </div>
                <div className="bg-gray-50/80 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm">
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Issue</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-base capitalize">
                    {job.fault_category?.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="bg-gray-50/80 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm">
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Received</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {new Date(job.received_date).toLocaleDateString("en-LK", { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {job.estimated_completion_date ? (
                  <div className="bg-gray-50/80 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm">
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Est. Ready By</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {new Date(job.estimated_completion_date).toLocaleDateString("en-LK", { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50/80 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm flex items-center justify-center">
                    <span className="text-gray-400 dark:text-gray-600 text-xs font-medium italic">Date pending</span>
                  </div>
                )}
                {job.estimated_cost != null && (
                  <div className="col-span-2 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 rounded-2xl border border-blue-100/50 dark:border-blue-800/30 shadow-inner mt-2 flex justify-between items-center">
                    <p className="text-blue-600/80 dark:text-blue-400/80 text-[10px] font-bold uppercase tracking-widest">Estimated Cost</p>
                    <p className="font-black text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                      LKR {Number(job.estimated_cost).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800/60 relative z-10">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 text-center">Repair Progress</p>
                <div className="px-0 sm:px-4 w-full max-w-full overflow-x-auto overflow-y-hidden pb-4 hide-scrollbar">
                  <div className="min-w-[400px]">
                    <ProgressBar status={job.status} />
                  </div>
                </div>
              </div>

              {job.status === "ready_for_pickup" && (
                <div className="mt-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/50 px-5 py-4 rounded-2xl shadow-sm flex items-start gap-4 relative z-10 transform hover:scale-[1.01] transition-transform duration-300">
                  <span className="text-3xl leading-none animate-bounce origin-bottom">🎉</span>
                  <div>
                    <p className="text-amber-900 dark:text-amber-200 font-bold text-lg mb-1">Your device is ready for collection!</p>
                    <p className="text-sm font-medium text-amber-700/80 dark:text-amber-400/80">Please visit the shop at your earliest convenience.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
