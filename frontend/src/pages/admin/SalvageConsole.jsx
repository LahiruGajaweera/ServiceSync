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
};

function ScraperPanel({ brand, model, onSelectPrice }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

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
          {result.listings?.length > 0 ? (
            <div className="max-h-36 overflow-y-auto space-y-1">
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
          ) : (
            <p className="text-xs text-gray-400">No listings found across scraped sites for this device</p>
          )}
          {result.avg_price != null && (
            <button
              type="button"
              onClick={() => onSelectPrice(result.avg_price)}
              className="w-full text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-semibold mt-2"
            >
              Use {result.listings?.length > 1 ? "Average " : ""}Price (LKR {Number(result.avg_price).toLocaleString()})
            </button>
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
  const [form, setForm]               = useState(EMPTY_FORM);

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
      };
      await api.post("/salvage/", payload);
      setShowCreate(false);
      setForm(EMPTY_FORM); setJob(null); setJobSearch("");
      fetchAssessments();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail[0].msg : (detail || "Failed to create assessment"));
    } finally {
      setSaving(false);
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
            <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-1 rounded-full">{pendingUnclaimed.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-50 border-b border-amber-100">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-semibold text-amber-800">Job ID</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-amber-800">Device</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-amber-800">Unclaimed Since</th>
                <th className="text-right px-5 py-2 text-xs font-semibold text-amber-800">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {pendingUnclaimed.map((p) => (
                <tr key={p.job_id} className="hover:bg-amber-100/30 transition-colors">
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
                {["Job ID", "Device", "Market Price", "Refurbish Value", "Salvage Value", "Recommendation", "Status", "Actions"].map((h) => (
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

          <ScraperPanel
            brand={selectedJob?.device_brand}
            model={selectedJob?.device_model}
            onSelectPrice={(price) => setForm((f) => ({ ...f, scraped_market_price: String(price) }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Market Price (LKR)</label>
              <input name="scraped_market_price" type="number" min="0" step="0.01" value={form.scraped_market_price} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Refurbish Cost (LKR)</label>
              <input name="refurbish_cost_estimate" type="number" min="0" step="0.01" value={form.refurbish_cost_estimate} onChange={handleChange} disabled
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500 cursor-not-allowed"
                title="Automatically calculated based on parts and labor used so far"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Refurbish Resale Value (LKR)</label>
              <input name="refurbish_value" type="number" min="0" step="0.01" value={form.refurbish_value} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Salvage Parts Value (LKR)</label>
              <input name="salvage_value" type="number" min="0" step="0.01" value={form.salvage_value} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Recommendation *</label>
            <select name="recommendation" value={form.recommendation} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
              <option value="" className="text-blue-600 font-bold">✨ Let Gemini AI Decide Automatically</option>
              <option value="refurbish">Refurbish — repair and resell</option>
              <option value="salvage_for_parts">Salvage for Parts — strip and stock</option>
            </select>
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
    </div>
  );
}
