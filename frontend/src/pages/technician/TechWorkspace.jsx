import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
import SmartPartsPanel from "../../components/SmartPartsPanel";
import LogPartModal from "./LogPartModal";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function TechWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  
  // Selected Job Tab
  const [searchParams, setSearchParams] = useSearchParams();
  const [logPartJob, setLogPartJob] = useState(null);
  
  const fetchMyJobs = async () => {
    try {
      const { data } = await api.get("/jobs/mine");
      const activeJobs = data.filter((j) => j.technician_id === user?.id && ["pending", "in_progress"].includes(j.status));
      setJobs(activeJobs);
      
      const jobIdParam = searchParams.get("job");
      if (activeJobs.length > 0 && !jobIdParam) {
        setSearchParams({ job: activeJobs[0].id });
      }
      
      // Notify sidebar to refresh active jobs
      window.dispatchEvent(new Event("refreshActiveJobs"));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jobIdParam = searchParams.get("job");
  const activeJob = jobs.find((j) => String(j.id) === jobIdParam);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">


      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading Workspace...</div>
      ) : jobs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 max-w-md w-full text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">No Active Jobs</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You don't have any jobs currently marked as "Pending" or "In Progress".</p>
            <button 
              onClick={() => navigate("/tech")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Active Job Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
            {activeJob ? (
              <WorkspaceJobPanel 
                key={activeJob.id} 
                job={activeJob} 
                onRefresh={fetchMyJobs} 
                onOpenPartLog={setLogPartJob}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a job to view details</div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {logPartJob && (
        <LogPartModal 
          job={logPartJob} 
          onClose={() => setLogPartJob(null)} 
          onSuccess={() => {
            setLogPartJob(null);
            fetchMyJobs();
          }} 
        />
      )}
    </div>
  );
}

function WorkspaceJobPanel({ job, onRefresh, onOpenPartLog }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reference for current job to use in event listeners
  const jobRef = useRef(job);
  const autoResumingRef = useRef(false);
  const awaySecsRef = useRef(0);
  
  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentJob = jobRef.current;
      if (!currentJob) return;

      if (document.hidden) {
        if (currentJob.current_timer_mode) {
          // Auto-pause
          localStorage.setItem(`auto_pause_${currentJob.id}`, JSON.stringify({
            mode: currentJob.current_timer_mode,
            time: Date.now()
          }));
          
          fetch(`${api.defaults.baseURL || "http://localhost:8000"}/jobs/${currentJob.id}/toggle-timer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("ss_token")}` },
            body: JSON.stringify({ mode: null }),
            keepalive: true
          });
        }
      } else {
        // Visible - check for auto-resume
        const autoPauseStr = localStorage.getItem(`auto_pause_${currentJob.id}`);
        if (autoPauseStr) {
          const autoPauseData = JSON.parse(autoPauseStr);
          const awaySecs = Math.floor((Date.now() - autoPauseData.time) / 1000);
          localStorage.removeItem(`auto_pause_${currentJob.id}`);
          
          autoResumingRef.current = true;
          awaySecsRef.current = awaySecs;
          
          api.post(`/jobs/${currentJob.id}/auto-resume`, {
            mode: autoPauseData.mode,
            away_seconds: awaySecs
          }).then(() => onRefresh());
        }
      }
    };

    const handleBeforeUnload = () => {
      const currentJob = jobRef.current;
      if (currentJob?.current_timer_mode) {
        localStorage.setItem(`auto_pause_${currentJob.id}`, JSON.stringify({
          mode: currentJob.current_timer_mode,
          time: Date.now()
        }));
        fetch(`${api.defaults.baseURL || "http://localhost:8000"}/jobs/${currentJob.id}/toggle-timer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("ss_token")}` },
          body: JSON.stringify({ mode: null }),
          keepalive: true
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    // Check auto-resume on mount
    const checkMountResume = async () => {
      const currentJob = jobRef.current;
      if (!currentJob) return;
      const autoPauseStr = localStorage.getItem(`auto_pause_${currentJob.id}`);
      if (autoPauseStr) {
        const autoPauseData = JSON.parse(autoPauseStr);
        const awaySecs = Math.floor((Date.now() - autoPauseData.time) / 1000);
        localStorage.removeItem(`auto_pause_${currentJob.id}`);
        
        autoResumingRef.current = true;
        awaySecsRef.current = awaySecs;
        
        try {
          await api.post(`/jobs/${currentJob.id}/auto-resume`, {
            mode: autoPauseData.mode,
            away_seconds: awaySecs
          });
          onRefresh();
        } catch (e) {
          console.error("Failed to auto-resume", e);
        }
      }
    };
    checkMountResume();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      const currentJob = jobRef.current;
      if (currentJob?.current_timer_mode) {
        localStorage.setItem(`auto_pause_${currentJob.id}`, JSON.stringify({
          mode: currentJob.current_timer_mode,
          time: Date.now()
        }));
        fetch(`${api.defaults.baseURL || "http://localhost:8000"}/jobs/${currentJob.id}/toggle-timer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("ss_token")}` },
          body: JSON.stringify({ mode: null }),
          keepalive: true
        });
      }
    };
  }, []);

  // Timer State state
  const [laborCost, setLaborCost] = useState("");
  
  // Status state
  const [newStatus, setNewStatus] = useState("completed");
  const [statusNotes, setStatusNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  
  // Structured Completion State
  const [actualFault, setActualFault] = useState("");
  const [identifiedFault, setIdentifiedFault] = useState("");
  const [pastFaults, setPastFaults] = useState([]);
  const [complexity, setComplexity] = useState("medium");
  const [diagnosticTime, setDiagnosticTime] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  
  // Revert state
  const [revertMode, setRevertMode] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [savedLaborCost, setSavedLaborCost] = useState(0);

  // QC Checklist State
  const [qcMicTested, setQcMicTested] = useState(false);
  const [qcCameraTested, setQcCameraTested] = useState(false);
  const [qcTouchTested, setQcTouchTested] = useState(false);
  const [qcBiometricsTested, setQcBiometricsTested] = useState(false);
  const [qcWifiTested, setQcWifiTested] = useState(false);
  const [qcChargingTested, setQcChargingTested] = useState(false);

  const fetchData = async () => {
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
  
  // Timer State
  const [diagSeconds, setDiagSeconds] = useState(0);
  const [repSeconds, setRepSeconds] = useState(0);
  
  useEffect(() => {
    // Clear auto-resuming state whenever job prop updates (refresh completed)
    autoResumingRef.current = false;
    awaySecsRef.current = 0;

    let interval;
    if (job?.active_repair_start_time) {
      const startTime = new Date(job.active_repair_start_time).getTime();
      const baseDiag = job.total_diagnostic_seconds || 0;
      const baseRep = job.total_active_repair_seconds || 0;
      
      const updateTimers = () => {
        let elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (autoResumingRef.current) {
            elapsed -= awaySecsRef.current;
            if (elapsed < 0) elapsed = 0;
        }
        
        if (job.current_timer_mode === "diagnostic") {
          setDiagSeconds(baseDiag + elapsed);
          setRepSeconds(baseRep);
        } else {
          setDiagSeconds(baseDiag);
          setRepSeconds(baseRep + elapsed);
        }
      };
      
      updateTimers();
      interval = setInterval(updateTimers, 1000);
    } else {
      setDiagSeconds(job?.total_diagnostic_seconds || 0);
      setRepSeconds(job?.total_active_repair_seconds || 0);
    }
    return () => clearInterval(interval);
  }, [job]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleToggleTimer = async (mode) => {
    try {
      if (mode === null && job.current_timer_mode) {
         // Manual pause - clear auto pause state if it exists just in case
         localStorage.removeItem(`auto_pause_${job.id}`);
      }
      await api.post(`/jobs/${job.id}/toggle-timer`, { mode });
      onRefresh(); // Refresh to get updated timestamps
    } catch (err) {
      alert("Failed to toggle timer");
    }
  };

  useEffect(() => {
    if (job) {
      setLaborCost(job.labor_cost && parseFloat(job.labor_cost) !== 0 ? job.labor_cost : "");
      setSavedLaborCost(job.labor_cost || 0);
      setRevertMode(false);
      setRevertReason("");
      setNewStatus("completed");
      setStatusNotes("");
      
      setActualFault(job.fault_category || "");
      setIdentifiedFault(job.identified_fault || "");
      setComplexity("medium");
      
      // Auto-fill from timer if available and not yet saved
      const diagMins = Math.ceil((job.total_diagnostic_seconds || 0) / 60);
      const repMins = Math.ceil((job.total_active_repair_seconds || 0) / 60);
      setDiagnosticTime(job.diagnostic_time_mins || (diagMins > 0 ? diagMins : ""));
      setRepairTime(job.repair_time_mins || (repMins > 0 ? repMins : ""));
      
      setResolutionNotes(job.resolution_notes || "");
      
      setQcMicTested(false);
      setQcCameraTested(false);
      setQcTouchTested(false);
      setQcBiometricsTested(false);
      setQcWifiTested(false);
      setQcChargingTested(false);
    }
  }, [job]);

  useEffect(() => {
    if (job?.id) {
      fetchData();
    }
  }, [job?.id]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading job data...</div>;
  }

  const partsTotal = parts.reduce((sum, p) => sum + Number(p.unit_cost) * p.quantity, 0);
  const totalCost = partsTotal + (parseFloat(laborCost) || 0);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    setSavingStatus(true);
    try {
      if (revertMode) {
        await api.post(`/jobs/${job.id}/revert-request`, {
          target_status: "pending",
          reason: revertReason
        });
      } else {
        if (newStatus === "failed") {
          await api.patch(`/jobs/${job.id}/labor`, { labor_cost: 0 });
          setSavedLaborCost(0);
        } else if (parseFloat(laborCost) !== savedLaborCost && (parseFloat(laborCost) || 0) >= 0) {
          await api.patch(`/jobs/${job.id}/labor`, { labor_cost: parseFloat(laborCost) || 0 });
          setSavedLaborCost(parseFloat(laborCost) || 0);
        }

        const payload = { status: newStatus, notes: statusNotes };
        if (newStatus === "completed") {
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
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || "Update failed");
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Scrollable Workspace Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          
          {/* Job Info */}
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100 text-lg">{job.device_brand} {job.device_model}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{job.fault_category?.replace(/_/g, " ")}</p>
              {job.fault_description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{job.fault_description}</p>}
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <JobStatusBadge status={job.status} />
              {job.revert_requested_to && (
                <p className="text-amber-600 text-[10px] font-bold uppercase tracking-wider">Revert Pending</p>
              )}
              
              {/* Timer UI */}
              {job.status !== "completed" && job.status !== "delivered" && job.status !== "ready_for_pickup" && (
                <div className="flex flex-row gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5 pr-3 border border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => handleToggleTimer("diagnostic")}
                      className={`flex items-center justify-start gap-1.5 w-[110px] px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        job.current_timer_mode === "diagnostic"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {job.current_timer_mode === "diagnostic" ? <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}
                      Diagnosing
                    </button>
                    <div className={`font-mono text-sm font-bold w-[70px] text-right ${job.current_timer_mode === "diagnostic" ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
                      {formatTime(diagSeconds)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5 pr-3 border border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => handleToggleTimer("repair")}
                      className={`flex items-center justify-start gap-1.5 w-[110px] px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        job.current_timer_mode === "repair"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {job.current_timer_mode === "repair" ? <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}
                      Repairing
                    </button>
                    <div className={`font-mono text-sm font-bold w-[70px] text-right ${job.current_timer_mode === "repair" ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                      {formatTime(repSeconds)}
                    </div>
                  </div>
                  
                  {job.current_timer_mode && (
                    <button 
                      onClick={() => handleToggleTimer(null)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 ml-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-md text-xs font-bold transition-colors border border-red-100 dark:border-red-900/30"
                      title="Pause Timer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" />
                      </svg>
                      Pause
                    </button>
                  )}
                </div>
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

          <hr className="border-gray-200 dark:border-gray-700" />

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
              <p className="text-xs text-gray-400 mb-4">Loading parts...</p>
            ) : parts.length === 0 ? (
              <div className="py-4 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mb-4">
                <p className="text-xs text-gray-400">No parts logged</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left text-gray-600 dark:text-gray-300 mb-4">
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

            <SmartPartsPanel 
              jobId={job.id} 
              initialParts={parts} 
              onPartsChanged={fetchData} 
            />
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />
          
          {/* Status Updates */}
          <div>
            <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Update Status</h4>
            {job.revert_requested_to ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-4 rounded-xl text-sm border border-amber-200 dark:border-amber-800">
                <p className="font-bold mb-1">Revert Request Pending</p>
                <p>You have requested to revert this job to <strong>{job.revert_requested_to.replace(/_/g, " ")}</strong>.</p>
                <p className="mt-2 text-xs">Waiting for admin approval. You cannot make further status changes right now.</p>
              </div>
            ) : revertMode ? (
              <form onSubmit={handleStatusUpdate} className="space-y-4 max-w-2xl">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-bold mb-2">Request Revert to Pending</p>
                  <textarea 
                    value={revertReason} 
                    onChange={(e) => setRevertReason(e.target.value)} 
                    rows={3} 
                    required
                    className="w-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    placeholder="Why do you need to go back to pending?"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRevertMode(false)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingStatus}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
                    {savingStatus ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleStatusUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Status</label>
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="completed">Mark Completed</option>
                      <option value="failed">Fail Job (Unidentified Fault)</option>
                      <option value="rejected">Fail Job (Identified but Unrepairable)</option>
                    </select>
                  </div>
                  
                  {newStatus !== "failed" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                        Labor Cost (LKR)
                      </label>
                      <input 
                        type="number" 
                        min="0" step="0.01" 
                        value={laborCost} 
                        onChange={(e) => setLaborCost(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00" 
                      />
                    </div>
                  )}
                </div>

                {newStatus === "completed" && (
                  <div className="space-y-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800 max-w-4xl">
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
                          list="past-faults-workspace"
                          value={identifiedFault} 
                          onChange={(e) => setIdentifiedFault(e.target.value)}
                          required
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Display Connector Damage"
                        />
                        <datalist id="past-faults-workspace">
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
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none max-w-4xl"
                      placeholder="What did you do?" />
                  </div>
                )}
                <div className="pt-2 max-w-4xl">
                  <button type="submit" disabled={savingStatus || (newStatus === "completed" && (!qcMicTested || !qcCameraTested || !qcTouchTested || !qcBiometricsTested || !qcWifiTested || !qcChargingTested))}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-bold transition-colors">
                    {savingStatus ? "Saving…" : "Update Job"}
                  </button>
                </div>
                <div className="mt-4 text-center max-w-4xl">
                  <button type="button" onClick={() => setRevertMode(true)} className="text-xs text-amber-600 hover:underline">
                    Need to go back a step? Request Revert
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
