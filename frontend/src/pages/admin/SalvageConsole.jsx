import { useEffect, useState } from "react";
import api from "../../services/api";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const REC_COLORS = {
  refurbish:        "bg-blue-100 text-blue-700",
  salvage_for_parts: "bg-purple-100 text-purple-700",
};

const EMPTY_FORM = {
  scraped_market_price: "",
  refurbish_cost_estimate: "",
  refurbish_value: "",
  salvage_value: "",
  recommendation: "",
  notes: "",
};

const CONDITION_ICONS = {
  good: "✅",
  fair: "🟡",
  poor: "🟠",
  broken: "❌",
};

function ScraperPanel({ brand, model, onSelectPrice }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (brand && model) {
      fetch();
    }
  }, [brand, model]);

  const fetch = async () => {
    if (!brand || !model) { setError("Select a job first to auto-fill brand/model"); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const { data } = await api.get("/scrape/price", { params: { brand, model } });
      setResult(data);
      if (data.error) setError(`Scraper note: ${data.error}`);
    } catch (e) {
      setError(e.response?.data?.detail || "Scrape failed — check network or try manually");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-800">Multi-Site Market Price Lookup</p>
          <p className="text-xs text-blue-600">{brand && model ? `Searching: ${brand} ${model}` : "Select a job above to enable"}</p>
        </div>
        <button
          type="button"
          onClick={fetch}
          disabled={loading || !brand || !model}
          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
        >
          {loading ? "Fetching…" : "Fetch Prices"}
        </button>
      </div>
      {error && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">{error}</p>}
      {result && !result.error && (
        <div className="space-y-2">
          <div className="flex gap-4 text-xs">
            {result.min_price != null && <span className="text-green-700 font-semibold">Min: LKR {Number(result.min_price).toLocaleString()}</span>}
            {result.avg_price != null && <span className="text-blue-700 font-semibold">Avg: LKR {Number(result.avg_price).toLocaleString()}</span>}
            {result.max_price != null && <span className="text-red-700 font-semibold">Max: LKR {Number(result.max_price).toLocaleString()}</span>}
          </div>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showDetails ? "Hide Details" : "Show Details"}
              </button>
              {result.avg_price != null && (
                <button
                  type="button"
                  onClick={() => onSelectPrice(result.avg_price)}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-semibold"
                >
                  Use {result.listings?.length > 1 ? "Average " : ""}Price (LKR {Number(result.avg_price).toLocaleString()})
                </button>
              )}
            </div>
            
            {showDetails && result.listings?.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1 mt-2">
                {result.listings.map((l, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                    <div className="flex-1 mr-3 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{l.title}</p>
                      {l.source && <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mt-0.5">{l.source}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-gray-800">LKR {Number(l.price).toLocaleString()}</span>
                      {result.listings?.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onSelectPrice(l.price)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Use
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      {result && result.listings?.length === 0 && !error && (
        <p className="text-xs text-gray-400">No listings found — enter market price manually</p>
      )}
    </div>
  );
}

export default function SalvageConsole() {
  const [assessments, setAssessments] = useState([]);
  const [pendingUnclaimed, setPendingUnclaimed] = useState([]);
  const [snoozeJob, setSnoozeJob]     = useState(null);
  const [snoozeDays, setSnoozeDays]   = useState("30");
  const [snoozeError, setSnoozeError] = useState("");

  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [formError, setFormError]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [generatingEstimate, setGeneratingEstimate] = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [partsBreakdown, setPartsBreakdown] = useState([]);
  const [showParts, setShowParts]     = useState(false);

  // Phase 2 states
  const [selectedBatch, setSelectedBatch] = useState([]);
  const [batching, setBatching] = useState(false);
  const [actualsModal, setActualsModal] = useState(null);
  const [actualsForm, setActualsForm] = useState({
    actual_refurbish_cost: "",
    actual_resale_price: "",
    actual_parts_revenue: ""
  });

  // Job search
  const [jobSearch, setJobSearch]   = useState("");
  const [jobResults, setJobResults] = useState([]);
  const [selectedJob, setJob]       = useState(null);

  const fetchAssessments = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [assRes, pendingRes] = await Promise.all([
        api.get("/salvage/"),
        api.get("/salvage/pending-unclaimed")
      ]);
      setAssessments(assRes.data);
      setPendingUnclaimed(pendingRes.data);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
    const interval = setInterval(() => {
      fetchAssessments(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const searchJobs = async (q) => {
    setJobSearch(q);
    if (q.length < 2) { setJobResults([]); return; }
    try {
      const { data } = await api.get("/jobs/");
      const filtered = data.filter(
        (j) =>
          j.job_id.toLowerCase().includes(q.toLowerCase()) ||
          (j.customer_name || "").toLowerCase().includes(q.toLowerCase())
      );
      setJobResults(filtered.slice(0, 8));
    } catch { /* ignore */ }
  };

  const selectJob = async (job) => {
    setJob(job);
    setJobSearch(`${job.job_id} — ${job.customer_name} (${job.device_brand} ${job.device_model})`);
    setJobResults([]);
    
    let cost = job.estimated_cost ? Number(job.estimated_cost) : 0;
    try {
      const { data } = await api.get(`/jobs/${job.id}/parts`);
      let partsTotal = 0;
      if (data.inventory_parts) partsTotal += data.inventory_parts.reduce((s, p) => s + (p.unit_price * p.quantity), 0);
      if (data.donor_parts) partsTotal += data.donor_parts.reduce((s, p) => s + (p.unit_price * p.quantity), 0);
      
      const labor = job.labor_cost ? Number(job.labor_cost) : 0;
      cost = partsTotal + labor;
    } catch (e) {
       console.error("Could not fetch parts", e);
       cost = job.estimated_cost ? Number(job.estimated_cost) : 0; // Fallback only on network error
    }
    
    setForm((f) => ({
      ...f,
      refurbish_cost_estimate: String(cost),
    }));
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedJob) { setFormError("Please select a job first"); return; }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        job_id: selectedJob.id,
        recommendation: form.recommendation || null,
        scraped_market_price:    form.scraped_market_price    ? parseFloat(form.scraped_market_price)    : null,
        refurbish_cost_estimate: form.refurbish_cost_estimate ? parseFloat(form.refurbish_cost_estimate) : null,
        refurbish_value:         form.refurbish_value         ? parseFloat(form.refurbish_value)         : null,
        salvage_value:           form.salvage_value           ? parseFloat(form.salvage_value)           : null,
        parts_breakdown: partsBreakdown.length > 0 ? partsBreakdown : null,
        notes: form.notes || null,
      };
      await api.post("/salvage/", payload);
      setShowCreate(false);
      setForm(EMPTY_FORM); setJob(null); setJobSearch(""); setPartsBreakdown([]); setShowParts(false);
      fetchAssessments();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail[0].msg : (detail || "Failed to create assessment"));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateEstimate = async () => {
    if (!selectedJob) { setFormError("Please select a job first"); return; }
    setFormError("");
    setGeneratingEstimate(true);
    try {
      const res = await api.post("/salvage/estimate", {
        job_id: selectedJob.id,
        scraped_market_price: form.scraped_market_price ? parseFloat(form.scraped_market_price) : null
      });
      setForm((f) => ({
        ...f,
        refurbish_cost_estimate: String(res.data.refurbish_cost_estimate),
        salvage_value: String(res.data.salvage_value),
        refurbish_value: String(res.data.refurbish_value),
        recommendation: res.data.recommendation
      }));
      // Store parts breakdown
      setPartsBreakdown(res.data.parts_breakdown || []);
      if (res.data.parts_breakdown?.length > 0) setShowParts(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail[0].msg : (detail || "Failed to generate AI estimate"));
    } finally {
      setGeneratingEstimate(false);
    }
  };

  const handleReassess = async (id) => {
    try {
      await api.post(`/salvage/${id}/reassess`);
      fetchAssessments();
    } catch (err) {
      alert(err.response?.data?.detail || "Re-assessment failed");
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.patch(`/salvage/${id}/status`, { status });
      fetchAssessments();
    } catch (err) {
      alert(err.response?.data?.detail || "Update failed");
    }
  };

  const toggleBatch = (job_id) => {
    setSelectedBatch(prev => prev.includes(job_id) ? prev.filter(id => id !== job_id) : [...prev, job_id]);
  };

  const handleBatchAssess = async () => {
    if (selectedBatch.length === 0) return;
    setBatching(true);
    try {
      await api.post("/salvage/batch-estimate", { job_ids: selectedBatch });
      setSelectedBatch([]);
      fetchAssessments();
    } catch (err) {
      alert("Batch processing failed");
    } finally {
      setBatching(false);
    }
  };

  const handleSaveActuals = async (e) => {
    e.preventDefault();
    if (!actualsModal) return;
    setSaving(true);
    try {
      await api.patch(`/salvage/${actualsModal.id}/actuals`, {
        actual_refurbish_cost: actualsForm.actual_refurbish_cost ? parseFloat(actualsForm.actual_refurbish_cost) : null,
        actual_resale_price: actualsForm.actual_resale_price ? parseFloat(actualsForm.actual_resale_price) : null,
        actual_parts_revenue: actualsForm.actual_parts_revenue ? parseFloat(actualsForm.actual_parts_revenue) : null,
      });
      setActualsModal(null);
      fetchAssessments();
    } catch (err) {
      alert("Failed to save actuals");
    } finally {
      setSaving(false);
    }
  };

  const handleAssessPending = async (p) => {
    const [brand, ...modelArr] = p.device.split(" ");
    const fakeJob = {
      id: p.job_id,
      job_id: p.job_public_id,
      customer_name: "Unclaimed",
      device_brand: brand,
      device_model: modelArr.join(" "),
      estimated_cost: 0,
      labor_cost: 0
    };
    setShowCreate(true);
    setFormError("");
    setForm(EMPTY_FORM);
    await selectJob(fakeJob);
  };

  const handleSnoozeClick = (p) => {
    setSnoozeJob(p);
    setSnoozeDays("30");
    setSnoozeError("");
  };

  const submitSnooze = async (e) => {
    e.preventDefault();
    if (!snoozeJob) return;
    const days = parseInt(snoozeDays, 10);
    if (isNaN(days) || days <= 0) {
      setSnoozeError("Please enter a valid number of days.");
      return;
    }
    
    setSaving(true);
    setSnoozeError("");
    try {
      await api.post(`/salvage/delay/${snoozeJob.job_id}?days=${days}`);
      setSnoozeJob(null);
      fetchAssessments();
    } catch (err) {
      setSnoozeError(err.response?.data?.detail || "Extend failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Salvage Console</h2>
          <p className="text-sm text-gray-500 mt-0.5">{assessments.length} assessment{assessments.length !== 1 ? "s" : ""} recorded</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setFormError(""); setForm(EMPTY_FORM); setJob(null); setJobSearch(""); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Assessment
        </button>
      </div>

      {pendingUnclaimed.length > 0 && (
        <div className="mb-8 bg-amber-50 rounded-xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-100/50 flex justify-between items-center">
            <h3 className="font-semibold text-amber-900">Pending Salvage (Unclaimed &gt; 1 Year)</h3>
            <div className="flex items-center gap-3">
              {selectedBatch.length > 0 && (
                <button onClick={handleBatchAssess} disabled={batching} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors">
                  {batching ? "Processing..." : `Assess Selected (${selectedBatch.length})`}
                </button>
              )}
              <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-1 rounded-full">{pendingUnclaimed.length}</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-50 border-b border-amber-100">
              <tr>
                <th className="px-5 py-2 w-10">
                  <input type="checkbox" onChange={(e) => setSelectedBatch(e.target.checked ? pendingUnclaimed.map(p => p.job_id) : [])} checked={selectedBatch.length === pendingUnclaimed.length && pendingUnclaimed.length > 0} className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500" />
                </th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-amber-800">Job ID</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-amber-800">Device</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-amber-800">Unclaimed Since</th>
                <th className="text-right px-5 py-2 text-xs font-semibold text-amber-800">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {pendingUnclaimed.map((p) => (
                <tr key={p.job_id} className="hover:bg-amber-100/30 transition-colors">
                  <td className="px-5 py-3">
                    <input type="checkbox" checked={selectedBatch.includes(p.job_id)} onChange={() => toggleBatch(p.job_id)} className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500" />
                  </td>
                  <td className="px-5 py-3 font-mono font-semibold text-blue-700 text-xs">{p.job_public_id}</td>
                  <td className="px-5 py-3 text-amber-900 font-medium">{p.device}</td>
                  <td className="px-5 py-3 text-amber-700 text-xs">{new Date(p.unclaimed_since).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleSnoozeClick(p)} className="text-xs font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg shadow-sm transition-all mr-2">
                      Extend Time
                    </button>
                    <button onClick={() => handleAssessPending(p)} className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg shadow-sm transition-all">
                      Assess
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Existing Assessments Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : assessments.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-xl mx-4 my-4">
            <p className="font-medium text-gray-500">No salvage assessments yet</p>
            <p className="text-sm text-gray-400 mt-1">Create an assessment for an unclaimed or delivered device</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Job ID", "Device", "Market Price", "Refurbish Value", "Salvage Value", "Recommendation", "Status", "Profit/Loss", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assessments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-blue-600 text-xs">{a.job_public_id}</td>
                  <td className="px-4 py-3 text-gray-700">{a.device}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.scraped_market_price ? `LKR ${Number(a.scraped_market_price).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.refurbish_value ? `LKR ${Number(a.refurbish_value).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.salvage_value ? `LKR ${Number(a.salvage_value).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${REC_COLORS[a.recommendation] ?? "bg-gray-100 text-gray-600"}`}>
                      {a.recommendation?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === "approved" ? (
                      a.profit_loss != null ? (
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${Number(a.profit_loss) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {Number(a.profit_loss) >= 0 ? "+" : "-"}LKR {Math.abs(Number(a.profit_loss)).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-500">AI Acc: {a.ai_accuracy_score ? `${(a.ai_accuracy_score*100).toFixed(0)}%` : "N/A"}</span>
                        </div>
                      ) : (
                        <button onClick={() => { setActualsModal(a); setActualsForm({ actual_refurbish_cost: a.actual_refurbish_cost||"", actual_resale_price: a.actual_resale_price||"", actual_parts_revenue: a.actual_parts_revenue||"" }); }} className="text-[10px] font-bold bg-white hover:bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm transition-colors whitespace-nowrap">
                          Record Actuals
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.status === "pending" ? (
                      <span className="text-xs text-gray-500 italic">Processing...</span>
                    ) : a.status === "assessed" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusUpdate(a.id, "approved")}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(a.id, "rejected")}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleReassess(a.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          🔄 Re-assess
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 italic">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Assessment Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Salvage Assessment">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>
          )}

          {selectedJob ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-0.5">Selected Job</p>
                <p className="text-sm font-bold text-gray-800">{selectedJob.job_id} — {selectedJob.device_brand} {selectedJob.device_model}</p>
              </div>
              <button type="button" onClick={() => { setJob(null); setJobSearch(""); }} className="text-xs text-blue-600 hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search Job *</label>
              <input
                value={jobSearch}
                onChange={(e) => searchJobs(e.target.value)}
                placeholder="Type job ID or customer name…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {jobResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {jobResults.map((j) => (
                    <button
                      key={j.id} type="button" onClick={() => selectJob(j)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <p className="text-xs font-mono font-bold text-blue-600">{j.job_id}</p>
                      <p className="text-sm text-gray-700">{j.customer_name} — {j.device_brand} {j.device_model}</p>
                      <p className="text-xs text-gray-400 capitalize">{j.status?.replace(/_/g, " ")}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <ScraperPanel
            brand={selectedJob?.device_brand}
            model={selectedJob?.device_model}
            onSelectPrice={(price) => setForm((f) => ({ ...f, scraped_market_price: String(price) }))}
          />
          
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateEstimate}
              disabled={generatingEstimate || !selectedJob}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {generatingEstimate ? "✨ Generating Estimate..." : "✨ Generate AI Estimate"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Market Price (LKR)</label>
              <p className="text-[10px] text-gray-400 mb-1 leading-tight">Value if in working condition</p>
              <input name="scraped_market_price" type="number" min="0" step="0.01" value={form.scraped_market_price} onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Refurbish Cost (LKR)</label>
              <p className="text-[10px] text-gray-400 mb-1 leading-tight">Estimated cost to repair</p>
              <input name="refurbish_cost_estimate" type="number" min="0" step="0.01" value={form.refurbish_cost_estimate} onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                placeholder="0.00" />
            </div>
            <div className="bg-blue-50/50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-100/50 dark:border-blue-800/50">
              <label className="block text-xs font-semibold text-blue-800 dark:text-blue-300">Refurbish Profit (LKR)</label>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mb-1 leading-tight">Net value if repaired & resold</p>
              <input name="refurbish_value" type="number" min="0" step="0.01" value={form.refurbish_value} onChange={handleChange}
                className="w-full border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 font-medium text-blue-900 dark:text-blue-100"
                placeholder="0.00" />
            </div>
            <div className="bg-purple-50/50 dark:bg-purple-900/20 p-2.5 rounded-lg border border-purple-100/50 dark:border-purple-800/50">
              <label className="block text-xs font-semibold text-purple-800 dark:text-purple-300">Salvage Parts Value (LKR)</label>
              <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mb-1 leading-tight">Value of extracted working parts</p>
              <input name="salvage_value" type="number" min="0" step="0.01" value={form.salvage_value} onChange={handleChange}
                className="w-full border border-purple-200 dark:border-purple-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 font-medium text-purple-900 dark:text-purple-100"
                placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-3">
            {form.recommendation && (
              <div className={`p-3 rounded-xl border ${form.recommendation === 'refurbish' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-300' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50 text-purple-800 dark:text-purple-300'}`}>
                <p className="text-sm font-bold flex items-center gap-2">
                  ✨ AI Recommends: {form.recommendation === 'refurbish' ? 'Refurbish (Repair and Resell)' : 'Salvage for Parts (Strip and Stock)'}
                </p>
                <p className="text-xs opacity-80 mt-0.5">Based on the calculated profitability of parts vs resale value.</p>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Recommendation *</label>
              <select name="recommendation" value={form.recommendation} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                <option value="" disabled>Select Recommendation</option>
                <option value="refurbish">Refurbish — repair and resell</option>
                <option value="salvage_for_parts">Salvage for Parts — strip and stock</option>
              </select>
            </div>
          </div>

          {/* Parts Breakdown Table */}
          {partsBreakdown.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowParts(!showParts)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  📦 Parts Breakdown ({partsBreakdown.length} parts)
                </span>
                <span className="text-xs text-gray-400">{showParts ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showParts && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {partsBreakdown.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                      <div className="flex items-center gap-2 flex-1">
                        <span>{CONDITION_ICONS[p.condition?.toLowerCase()] || "⚪"}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">{p.part}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        p.condition?.toLowerCase() === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        p.condition?.toLowerCase() === 'fair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        p.condition?.toLowerCase() === 'broken' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>{p.condition}</span>
                      <span className="ml-3 font-semibold text-gray-800 dark:text-gray-100 w-24 text-right">
                        {p.value > 0 ? `LKR ${Number(p.value).toLocaleString()}` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 font-bold text-xs">
                    <span className="text-gray-700 dark:text-gray-200">Total Salvage Value</span>
                    <span className="text-purple-700 dark:text-purple-300 w-24 text-right">
                      LKR {partsBreakdown.reduce((s, p) => s + (p.value || 0), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Add any notes about this assessment..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {saving ? "Saving…" : "Create Assessment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Snooze Modal */}
      <Modal open={!!snoozeJob} onClose={() => setSnoozeJob(null)} title="Extend Time">
        <form onSubmit={submitSnooze} className="space-y-4">
          <p className="text-sm text-gray-600">
            How many days do you want to extend the pickup time for <strong>{snoozeJob?.device}</strong>?
            This will revert its status back to <strong>Ready for Pickup</strong> for the specified duration.
          </p>
          
          {snoozeError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{snoozeError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Days to delay</label>
            <input
              type="number"
              min="1"
              max="365"
              value={snoozeDays}
              onChange={(e) => setSnoozeDays(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSnoozeJob(null)}
              className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Extend Time"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Actuals Modal */}
      <Modal open={!!actualsModal} onClose={() => setActualsModal(null)} title="Record Actual Outcomes">
        <form onSubmit={handleSaveActuals} className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
            <p className="text-sm font-semibold text-blue-900">
              AI Recommended: <span className="uppercase">{actualsModal?.recommendation?.replace(/_/g, " ")}</span>
            </p>
          </div>
          
          {actualsModal?.recommendation === "refurbish" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Refurbish Cost (LKR)</label>
                <input type="number" required min="0" step="0.01" value={actualsForm.actual_refurbish_cost} onChange={(e) => setActualsForm({...actualsForm, actual_refurbish_cost: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Resale Price (LKR)</label>
                <input type="number" required min="0" step="0.01" value={actualsForm.actual_resale_price} onChange={(e) => setActualsForm({...actualsForm, actual_resale_price: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Parts Revenue (LKR)</label>
              <input type="number" required min="0" step="0.01" value={actualsForm.actual_parts_revenue} onChange={(e) => setActualsForm({...actualsForm, actual_parts_revenue: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setActualsModal(null)} className="flex-1 bg-white border border-gray-300 py-2.5 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors">{saving ? "Saving..." : "Save Actuals"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
