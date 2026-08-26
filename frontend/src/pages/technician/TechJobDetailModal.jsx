import { useEffect, useState } from "react";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
import SmartPartsPanel from "../../components/SmartPartsPanel";

const STATUS_OPTIONS = [
  { value: "in_progress",      label: "Mark In Progress" },
  { value: "completed",        label: "Mark Completed" },
  { value: "failed",           label: "Fail Job (Unidentified Fault)" },
  { value: "rejected",         label: "Fail Job (Identified but Unrepairable)" },
];

export default function TechJobDetailModal({ open, job, onClose, onDone, onOpenPartLog, partRefreshTrigger }) {
  if (!open) return null;
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Labor cost state
  const [laborCost, setLaborCost] = useState("");
  const [savingLabor, setSavingLabor] = useState(false);
  
  // Status state
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  
  // Structured Completion State
  const [actualFault, setActualFault] = useState("");
  const [identifiedFault, setIdentifiedFault] = useState("");
  const [pastFaults, setPastFaults] = useState([]);
  const [complexity, setComplexity] = useState("medium");
  const [diagnosticTime, setDiagnosticTime] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  
  // QC Checklist State
  const [qcMicTested, setQcMicTested] = useState(false);
  const [qcCameraTested, setQcCameraTested] = useState(false);
  const [qcTouchTested, setQcTouchTested] = useState(false);
  const [qcBiometricsTested, setQcBiometricsTested] = useState(false);
  const [qcWifiTested, setQcWifiTested] = useState(false);
  const [qcChargingTested, setQcChargingTested] = useState(false);
  
  // Revert state
  const [revertMode, setRevertMode] = useState(false);
  const [revertTarget, setRevertTarget] = useState("pending");
  const [revertReason, setRevertReason] = useState("");

  const [savedLaborCost, setSavedLaborCost] = useState(0);

  const fetchData = async () => {
    if (!job) return;
    setLoading(true);
    try {
      const [partsRes, faultsRes] = await Promise.all([
        api.get(`/jobs/${job.id}/parts`),
        api.get('/jobs/faults/identified').catch(() => ({ data: [] }))
      ]);
      setParts(partsRes.data);
      if (faultsRes.data) {
        setPastFaults(faultsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reset form fields on load
  useEffect(() => {
    if (open && job) {
      setLaborCost(job.labor_cost && parseFloat(job.labor_cost) !== 0 ? job.labor_cost : "");
      setSavedLaborCost(job.labor_cost || 0);
      setRevertMode(false);
      setRevertReason("");
      setRevertTarget(job.status === "completed" ? "in_progress" : "pending");
      const nextStatus = job.status === "pending" ? "in_progress" : "completed";
      setNewStatus(nextStatus);
      setStatusNotes("");
      setEstimatedCost(job.estimated_cost || "");
      
      setActualFault(job.fault_category || "");
      setIdentifiedFault(job.identified_fault || "");
      setComplexity("medium");
      setDiagnosticTime("");
      setRepairTime("");
      setResolutionNotes("");
      
      setQcMicTested(false);
      setQcCameraTested(false);
      setQcTouchTested(false);
      setQcBiometricsTested(false);
      setQcWifiTested(false);
      setQcChargingTested(false);
    }
  }, [open, job]);

  // Fetch parts on load and when partRefreshTrigger changes
  useEffect(() => {
    if (open && job) {
      fetchData();
    }
  }, [open, job, partRefreshTrigger]);

  if (!open || !job) return null;

  const partsTotal = parts.reduce((sum, p) => sum + Number(p.unit_cost) * p.quantity, 0);
  const totalCost = partsTotal + (parseFloat(laborCost) || 0);

  const handleSaveLabor = async () => {
    setSavingLabor(true);
    try {
      await api.patch(`/jobs/${job.id}/labor`, { labor_cost: parseFloat(laborCost) || 0 });
      setSavedLaborCost(parseFloat(laborCost) || 0);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save labor cost");
    } finally {
      setSavingLabor(false);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    setSavingStatus(true);
    try {
      if (revertMode) {
        await api.post(`/jobs/${job.id}/revert-request`, {
          target_status: revertTarget,
          reason: revertReason
        });
      } else {
        // Automatically save labor cost if it has changed
        if (newStatus === "failed") {
          await api.patch(`/jobs/${job.id}/labor`, { labor_cost: 0 });
          setSavedLaborCost(0);
        } else if (parseFloat(laborCost) !== savedLaborCost && (parseFloat(laborCost) || 0) >= 0) {
          await api.patch(`/jobs/${job.id}/labor`, { labor_cost: parseFloat(laborCost) || 0 });
          setSavedLaborCost(parseFloat(laborCost) || 0);
        }

        const payload = { status: newStatus, notes: statusNotes };
        if (newStatus === "completed") {
          if (estimatedCost !== "") payload.estimated_cost = parseFloat(estimatedCost);
          
          if (!diagnosticTime || !repairTime || !resolutionNotes) {
            alert("Diagnostic Time, Repair Time, and Action Taken are required to complete a job.");
            setSavingStatus(false);
            return;
          }
          if (!qcMicTested || !qcCameraTested || !qcTouchTested || !qcBiometricsTested || !qcWifiTested || !qcChargingTested) {
            alert("Please complete the Quality Control checklist.");
            setSavingStatus(false);
            return;
          }
          
          payload.actual_fault = actualFault;
          payload.identified_fault = identifiedFault;
          payload.complexity_level = complexity;
          payload.diagnostic_time_mins = parseInt(diagnosticTime, 10);
          payload.repair_time_mins = parseInt(repairTime, 10);
          payload.resolution_notes = resolutionNotes;
          
          payload.qc_mic_tested = qcMicTested;
          payload.qc_camera_tested = qcCameraTested;
          payload.qc_touch_tested = qcTouchTested;
          payload.qc_biometrics_tested = qcBiometricsTested;
          payload.qc_wifi_tested = qcWifiTested;
          payload.qc_charging_tested = qcChargingTested;
        }
        await api.patch(`/jobs/${job.id}/status`, payload);
      }
      onDone();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Job Detail — {job.job_id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl leading-none">&times;</button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {job.rework_of_job_id && (
            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <h4 className="text-purple-900 dark:text-purple-200 font-bold text-xs">
                  Customer Warranty Claim (Rework)
                </h4>
                <p className="text-purple-700 dark:text-purple-300 text-[11px] mt-0.5">
                  This is a free guarantee repair for a previous job.
                </p>
              </div>
              <span className="text-[10px] bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold px-2 py-0.5 rounded">
                Free Warranty
              </span>
            </div>
          )}
          
          {/* Job Info */}
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">{job.device_brand} {job.device_model}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{job.fault_category?.replace(/_/g, " ")}</p>
              {job.fault_description && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{job.fault_description}</p>}
            </div>
            <div className="text-right">
              <JobStatusBadge status={job.status} />
              {job.revert_requested_to && (
                <p className="text-amber-600 text-[10px] font-bold uppercase tracking-wider mt-1">Revert Pending</p>
              )}
            </div>
          </div>

          {(job.physical_condition || (job.images && job.images.length > 0)) && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
              {job.physical_condition && (
                <div className="mb-3">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Physical Condition</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{job.physical_condition}</p>
                </div>
              )}
              {job.images && job.images.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Condition Photos</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {job.images.map((img) => (
                      <a key={img.id} href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.file_path}`} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.file_path}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" alt="Condition" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800"></div>

          {/* Parts Section */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Parts Used</h4>
              {!["completed", "ready_for_pickup", "delivered", "unclaimed"].includes(job.status) && (
                <button
                  type="button"
                  onClick={() => onOpenPartLog(job)}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  + Log Part
                </button>
              )}
            </div>
            
            {loading ? (
              <p className="text-xs text-gray-400">Loading parts...</p>
            ) : parts.length === 0 ? (
              <div className="py-4 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                <p className="text-xs text-gray-400">No parts logged</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left text-gray-600 dark:text-gray-300">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
                    <th className="pb-2 font-medium">Part</th>
                    <th className="pb-2 font-medium text-center">Qty</th>
                    <th className="pb-2 font-medium text-right">Unit</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {parts.map(p => (
                    <tr key={p.id}>
                      <td className="py-2 text-gray-800 dark:text-gray-100">{p.part_name || "—"}</td>
                      <td className="py-2 text-center">{p.quantity}</td>
                      <td className="py-2 text-right">LKR {Number(p.unit_cost).toLocaleString()}</td>
                      <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-100">LKR {(Number(p.unit_cost) * p.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {parts.length > 0 && (
              <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 mt-3">
                <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">Parts Total</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">LKR {partsTotal.toLocaleString()}</span>
              </div>
            )}
            
            <div className="mt-4">
              <SmartPartsPanel brand={job.device_brand || ""} model={job.device_model || ""} />
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800"></div>

          {/* Status Update Form */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Update Status</h4>
            {["completed", "ready_for_pickup", "delivered", "unclaimed"].includes(job.status) && !revertMode ? (
              <div className="text-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">Job is {job.status.replace(/_/g, " ")}. Request revert if you need to make changes.</p>
                <button type="button" onClick={() => setRevertMode(true)} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors">
                  Request Status Revert
                </button>
              </div>
            ) : revertMode ? (
              <form onSubmit={handleStatusUpdate} className="space-y-3 bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-1">Revert To Status</label>
                  <select value={revertTarget} onChange={(e) => setRevertTarget(e.target.value)}
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-800">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-1">Reason for Revert *</label>
                  <textarea value={revertReason} onChange={(e) => setRevertReason(e.target.value)} rows={2} required
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none bg-white dark:bg-gray-800"
                    placeholder="Explain why this needs to go back..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => ["completed", "ready_for_pickup", "delivered", "unclaimed"].includes(job.status) ? onClose() : setRevertMode(false)}
                    className="flex-1 border border-amber-300 text-amber-800 py-2 rounded-lg text-xs font-semibold hover:bg-amber-100">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingStatus}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white py-2 rounded-lg text-xs font-bold">
                    {savingStatus ? "Sending…" : "Send Request"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleStatusUpdate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Status</label>
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {STATUS_OPTIONS.map((s) => {
                        let isDisabled = false;
                        if (job.status === "pending") {
                          isDisabled = s.value !== "in_progress";
                        } else if (job.status === "in_progress") {
                          isDisabled = s.value === "in_progress";
                        } else {
                          isDisabled = true;
                        }
                        return (
                          <option key={s.value} value={s.value} disabled={isDisabled}>
                            {s.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {newStatus !== "failed" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Labor Cost (LKR)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        min="0" step="0.01" 
                        value={laborCost} 
                        onChange={(e) => setLaborCost(e.target.value)}
                        disabled={(newStatus !== "completed" && newStatus !== "rejected") || revertMode}
                        className="w-full text-right border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:bg-gray-800 disabled:text-gray-500 dark:text-gray-400"
                        placeholder="0.00" 
                      />
                    </div>
                  </div>
                  )}
                </div>
                {newStatus === "completed" && (
                  <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800">
                    <h5 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Completion Report</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Actual Fault Category</label>
                        <select value={actualFault} onChange={(e) => setActualFault(e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="screen">Screen</option>
                          <option value="battery">Battery</option>
                          <option value="charging_port">Charging Port</option>
                          <option value="camera">Camera</option>
                          <option value="speaker">Speaker</option>
                          <option value="software">Software</option>
                          <option value="water_damage">Water Damage</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Fault Identified *</label>
                        <input 
                          type="text" 
                          list="past-faults-list"
                          value={identifiedFault} 
                          onChange={(e) => setIdentifiedFault(e.target.value)}
                          required
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Display Connector Damage"
                        />
                        <datalist id="past-faults-list">
                          {pastFaults.map((f, idx) => (
                            <option key={idx} value={f} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Job Complexity</label>
                      <select value={complexity} onChange={(e) => setComplexity(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="low">Low (Basic replacement, quick fix)</option>
                        <option value="medium">Medium (Standard repair)</option>
                        <option value="high">High (Micro-soldering, board level, water damage)</option>
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Diagnostic Time (mins) *</label>
                        <input type="number" min="0" value={diagnosticTime} onChange={(e) => setDiagnosticTime(e.target.value)} required
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 15" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Repair Time (mins) *</label>
                        <input type="number" min="0" value={repairTime} onChange={(e) => setRepairTime(e.target.value)} required
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 45" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Resolution / Action Taken *</label>
                      <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} required
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Explain exactly what you did to fix the device..." />
                    </div>

                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                      <h5 className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-3">Quality Control (QC) Checklist *</h5>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">You must test and verify all the following before completing this job.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={qcMicTested} onChange={(e) => setQcMicTested(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <span>Mic & Speaker Tested</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={qcCameraTested} onChange={(e) => setQcCameraTested(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <span>Cameras (Front & Rear) Tested</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={qcTouchTested} onChange={(e) => setQcTouchTested(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <span>Touch & Display Tested</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={qcBiometricsTested} onChange={(e) => setQcBiometricsTested(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <span>FaceID / Fingerprint Tested</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={qcWifiTested} onChange={(e) => setQcWifiTested(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <span>Wi-Fi & Bluetooth Tested</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={qcChargingTested} onChange={(e) => setQcChargingTested(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                          <span>Charging Port Tested</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
                {newStatus !== "completed" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
                    <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={2}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      placeholder="What did you do?" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" disabled={savingStatus || (newStatus === "completed" && (!qcMicTested || !qcCameraTested || !qcTouchTested || !qcBiometricsTested || !qcWifiTested || !qcChargingTested))}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
                    {savingStatus ? "Saving…" : "Update Status"}
                  </button>
                </div>
                {!["completed", "ready_for_pickup", "delivered", "unclaimed"].includes(job.status) && (
                  <div className="mt-2 text-center">
                    <button type="button" onClick={() => setRevertMode(true)} className="text-xs text-amber-600 hover:underline">
                      Need to go back a step? Request Revert
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800"></div>

          {/* Totals Section */}
          <div>
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-4 rounded-xl mt-4">
              <span className="text-base font-bold text-blue-900">Total Repair Cost</span>
              <span className="text-xl font-bold text-blue-700">LKR {totalCost.toLocaleString()}</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
