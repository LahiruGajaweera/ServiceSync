import React, { useState, useEffect } from "react";
import api from "../services/api";

export default function CreateReworkModal({ isOpen, onClose, onSuccess, initialJobId }) {
  const [jobId, setJobId] = useState("");
  const [parentJob, setParentJob] = useState(null);
  const [reworkType, setReworkType] = useState("warranty");
  const [reason, setReason] = useState("");
  const [technician, setTechnician] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearchForId = async (idToSearch) => {
    if (!idToSearch) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/jobs/track/${idToSearch}`);
      setParentJob(res.data);
      if (res.data.is_warranty_valid === false) {
        setReworkType("rework");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Job not found");
      setParentJob(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialJobId) {
        setJobId(initialJobId);
        handleSearchForId(initialJobId);
      } else {
        setJobId("");
        setParentJob(null);
        setReason("");
        setReworkType("warranty");
        setError("");
      }
    }
  }, [isOpen, initialJobId]);

  if (!isOpen) return null;

  const handleSearch = () => handleSearchForId(jobId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parentJob) return;
    
    const token = localStorage.getItem("access_token");
    setLoading(true);
    
    // We assume the original job had customer_id. The track endpoint might not expose it.
    // If the frontend has an API wrapper, it should fetch the full job details via admin GET /api/jobs
    try {
      // Fetch full job to get customer_id
      const fullRes = await api.get(`/jobs/`);
      const allJobs = fullRes.data;
      const fullJob = allJobs.find(j => j.job_id === parentJob.job_id);
      
      if (!fullJob) throw new Error("Cannot find full job details to copy");

      const payload = {
        customer_id: fullJob.customer_id,
        technician_id: technician || null,
        rework_of_job_id: fullJob.id,
        job_type: reworkType,
        rework_reason: reason,
        device_brand: fullJob.device_brand,
        device_model: fullJob.device_model,
        device_imei: fullJob.device_imei,
        fault_category: fullJob.fault_category,
        fault_description: fullJob.fault_description,
      };

      await api.post(`/jobs/`, payload);

      onSuccess();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map(d => `${d.loc.slice(-1)[0]}: ${d.msg}`).join(' | '));
      } else {
        setError(err.message || "Failed to create rework job");
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto hide-scrollbar">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Create Rework / Warranty Claim</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">
            &times;
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Search Parent Job ID</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setParentJob(null);
                }}
                placeholder="e.g. SS-A1B2C3D4"
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button 
                type="button"
                onClick={handleSearch}
                disabled={loading || !jobId.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Search
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {parentJob && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Parent Job:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{parentJob.job_id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Device:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{parentJob.device_brand} {parentJob.device_model}</span>
                </div>
                {parentJob.is_warranty_valid !== null && parentJob.is_warranty_valid !== undefined && (
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <span className="text-gray-500 dark:text-gray-400">Warranty:</span>
                    <span className={`font-semibold ${parentJob.is_warranty_valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {parentJob.is_warranty_valid ? `Valid until ${parentJob.warranty_valid_until}` : "Expired"}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Rework Type</label>
              <select 
                value={reworkType}
                onChange={(e) => setReworkType(e.target.value)}
                disabled={!parentJob || loading}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="warranty" disabled={parentJob && parentJob.is_warranty_valid === false}>
                  Warranty Claim {parentJob && parentJob.is_warranty_valid === false ? "(Expired)" : ""}
                </option>
                <option value="rework">Paid Rework</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Fault / Reason</label>
              <textarea 
                rows="3" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!parentJob || loading}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none disabled:opacity-50 disabled:cursor-not-allowed" 
                placeholder="Describe the issue..."
                required
              ></textarea>
            </div>
            
            <div className="flex gap-3 pt-1">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={loading || !parentJob}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {loading ? "Creating..." : "Create Job"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
