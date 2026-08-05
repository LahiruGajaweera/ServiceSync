import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

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
      {/* Track line */}
      <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-gray-200 mx-3" />
      <div
        className="absolute top-3.5 left-0 h-0.5 bg-blue-500 mx-3 transition-all duration-500"
        style={{ width: current > 0 ? `${(current / (STEPS.length - 1)) * 94}%` : "0%" }}
      />

      {STEPS.map((step, i) => (
        <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
          <div
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
              i < current
                ? "bg-blue-500 border-blue-500 text-white"
                : i === current
                ? "bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100"
                : "bg-white border-gray-300 text-gray-400"
            }`}
          >
            {i + 1}
          </div>
          <p
            className={`text-xs mt-2 text-center leading-tight ${
              i <= current ? "text-blue-600 font-medium" : "text-gray-400"
            }`}
          >
            {step.label}
          </p>
        </div>
      ))}
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
    e.preventDefault();
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
      pending:          "bg-gray-100 text-gray-600",
      in_progress:      "bg-blue-100 text-blue-700",
      completed:        "bg-purple-100 text-purple-700",
      ready_for_pickup: "bg-amber-100 text-amber-700",
      delivered:        "bg-green-100 text-green-700",
      unclaimed:        "bg-red-100 text-red-700",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-xl font-extrabold text-blue-600 tracking-tight">ServiceSync</span>
            <span className="ml-2 text-xs text-gray-400">Repair Tracker</span>
          </div>
          <a href="/login" className="text-sm text-blue-500 hover:underline">
            Staff Login →
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Search */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Track Your Repair</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter the Job ID printed on your repair receipt
          </p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="e.g. SS-A3F9C2E1"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white
                         px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? "…" : "Track"}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Result card */}
        {job && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            {/* Job header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Job ID</p>
                <p className="text-xl font-bold text-gray-800">{job.job_id}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(job.status)}`}>
                {job.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Device</p>
                <p className="font-medium text-gray-700">{job.device_brand} {job.device_model}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Issue</p>
                <p className="font-medium text-gray-700 capitalize">
                  {job.fault_category?.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Received</p>
                <p className="font-medium text-gray-700">
                  {new Date(job.received_date).toLocaleDateString("en-LK")}
                </p>
              </div>
              {job.estimated_completion_date && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Est. Ready By</p>
                  <p className="font-medium text-gray-700">
                    {new Date(job.estimated_completion_date).toLocaleDateString("en-LK")}
                  </p>
                </div>
              )}
              {job.estimated_cost != null && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Estimated Cost</p>
                  <p className="font-medium text-gray-700">
                    LKR {Number(job.estimated_cost).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Repair Progress</p>
              <ProgressBar status={job.status} />
            </div>

            {job.status === "ready_for_pickup" && (
              <div className="mt-5 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm font-medium">
                Your device is ready for collection. Please visit the shop.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
