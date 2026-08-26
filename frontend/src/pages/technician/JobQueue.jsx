import { useEffect, useState } from "react";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
import TechJobDetailModal from "./TechJobDetailModal";
import ScanField from "../../components/ScanField";

const STATUS_TABS = [
  { value: "",             label: "All Mine" },
  { value: "pending",      label: "Pending" },
  { value: "in_progress",  label: "In Progress" },
  { value: "completed",    label: "Completed" },
];

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function JobQueue({ mode = "customer" }) {
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setFilter]   = useState("");
  const [updateJob, setUpdateJob]   = useState(null); // Used as detailJob now
  const [claimingId, setClaimingId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null); // Unassigned claim modal

  // Part logging states
  const [partJob, setPartJob]       = useState(null);
  const [invItems, setInvItems]     = useState([]);
  const [partItemId, setPartItemId] = useState("");
  const [partBatch, setPartBatch]   = useState(null);
  const [partQty, setPartQty]       = useState(1);
  const [partError, setPartError]   = useState("");
  const [partInfo, setPartInfo]     = useState("");
  const [savingPart, setSavingPart] = useState(false);
  const [partLoggedCounter, setPartLoggedCounter] = useState(0);
  const [partSource, setPartSource] = useState("inventory");
  const [donorPartId, setDonorPartId] = useState(null);

  const fetchJobs = async (status = statusFilter) => {
    setLoading(true);
    try {
      const { data } = await api.get("/jobs/mine", { params: status ? { status } : {} });
      const filtered = data.filter(job => {
        const isRefurbish = job.admin_alert && job.admin_alert.includes("Approved for Refurbishment");
        return mode === "refurbish" ? isRefurbish : !isRefurbish;
      });
      setJobs(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(statusFilter); }, [mode]);

  const handleTabChange = (s) => { setFilter(s); fetchJobs(s); };

  const handleClaim = async (job) => {
    setClaimingId(job.id);
    try {
      await api.patch(`/jobs/${job.id}/claim`);
      setSelectedJob(null);
      fetchJobs(statusFilter);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to claim job");
    } finally {
      setClaimingId(null);
    }
  };

  const openLogPart = async (job) => {
    setPartJob(job);
    setPartItemId(""); setPartBatch(null); setPartQty(1); setPartError(""); setPartInfo("");
    try {
      const { data } = await api.get("/inventory/", { params: {} });
      setInvItems(data.filter((i) => i.quantity > 0));
    } catch { setInvItems([]); }
  };

  const handleScan = async (code) => {
    setPartError(""); setPartInfo(""); setPartSource("inventory"); setDonorPartId(null); setPartItemId(""); setPartBatch(null);
    try {
      const { data } = await api.get(`/inventory/scan/${encodeURIComponent(code)}`);
      if (data.donor_part) {
        setPartSource("donor");
        setDonorPartId(data.donor_part.id);
        setPartInfo(`Matched Donor Part: ${data.donor_part.part_name} - Rs. ${data.donor_part.estimated_value.toFixed(2)}`);
      } else {
        setPartSource("inventory");
        setPartItemId(data.item.id);
        if (data.batch) {
          setPartBatch({ id: data.batch.id, code: data.batch.batch_code });
          setPartInfo(`Matched ${data.item.name} · batch ${data.batch.batch_code} (${data.batch.quantity_remaining} left)`);
        } else {
          setPartBatch(null);
          setPartInfo(`Matched ${data.item.name} · ${data.item.quantity} in stock (FIFO)`);
        }
      }
    } catch (err) {
      setPartBatch(null);
      setPartError(err.response?.data?.detail || "Code not recognised");
    }
  };

  const handleLogPart = async (e) => {
    e.preventDefault();
    setPartError("");
    setSavingPart(true);
    try {
      if (partSource === "donor") {
        await api.post(`/jobs/${partJob.id}/parts`, {
          part_source: "donor",
          donor_part_id: donorPartId,
          quantity: parseInt(partQty, 10),
        });
      } else {
        await api.post(`/jobs/${partJob.id}/parts`, {
          part_source: "inventory",
          inventory_item_id: partItemId || null,
          batch_id: partBatch?.id || null,
          quantity: parseInt(partQty, 10),
        });
      }
      setPartJob(null);
      setPartLoggedCounter((prev) => prev + 1);
    } catch (err) {
      setPartError(err.response?.data?.detail || "Failed to log part");
    } finally {
      setSavingPart(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {mode === "refurbish" ? "Store Refurbishments" : "Customer Job Queue"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{jobs.length} job{jobs.length !== 1 ? "s" : ""} assigned to me or unassigned</p>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === tab.value ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mx-4 my-4">
            <p className="font-medium text-gray-500 dark:text-gray-400">No jobs here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {["Job ID", "Customer", "Device", "Fault", "Status", "Est. Ready"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {jobs.map((job) => (
                <tr 
                  key={job.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 cursor-pointer transition-colors"
                  onClick={() => job.technician_id ? setUpdateJob(job) : setSelectedJob(job)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">
                    {job.job_id}
                    {!job.technician_id && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{job.customer_name}</p>
                    <p className="text-xs text-gray-400">{job.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{job.device_brand} {job.device_model}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{job.fault_category?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {job.estimated_completion_date
                      ? new Date(job.estimated_completion_date).toLocaleDateString("en-LK")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TechJobDetailModal 
        open={!!updateJob} 
        job={updateJob} 
        onClose={() => setUpdateJob(null)} 
        onDone={() => { setUpdateJob(null); fetchJobs(statusFilter); }} 
        onOpenPartLog={openLogPart} 
        partRefreshTrigger={partLoggedCounter}
      />

      {/* Claim Job Modal for Unassigned */}
      <Modal open={!!selectedJob} onClose={() => setSelectedJob(null)} title={`Claim Job — ${selectedJob?.job_id || ""}`}>
        {selectedJob && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <JobStatusBadge status={selectedJob.status} />
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                Unassigned
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Device</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{selectedJob.device_brand} {selectedJob.device_model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Fault</p>
                <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{selectedJob.fault_category?.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{selectedJob.customer_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Est. Ready</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {selectedJob.estimated_completion_date
                    ? new Date(selectedJob.estimated_completion_date).toLocaleDateString("en-LK")
                    : "—"}
                </p>
              </div>
            </div>

            {selectedJob.fault_description && (
              <div>
                <p className="text-xs text-gray-400">Description</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">{selectedJob.fault_description}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleClaim(selectedJob)}
                disabled={claimingId === selectedJob.id}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {claimingId === selectedJob.id ? "Claiming…" : "Claim Job"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Log a part used on a claimed job */}
      <Modal open={!!partJob} onClose={() => setPartJob(null)} title={`Log Part — ${partJob?.job_id || ""}`}>
        <form onSubmit={handleLogPart} className="space-y-4">
          {partError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{partError}</div>
          )}
          {partInfo && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">{partInfo}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Scan part label</label>
            <ScanField onCode={handleScan} placeholder="Scan QR / SKU / batch code" />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800" /></div>
            <div className="relative flex justify-center"><span className="bg-white dark:bg-gray-800 px-2 text-xs text-gray-400">or pick manually</span></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Inventory Part *</label>
            <select required={partSource !== "donor"} disabled={partSource === "donor"} value={partItemId} onChange={(e) => { setPartItemId(e.target.value); setPartBatch(null); setPartInfo(""); setPartSource("inventory"); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
              <option value="">{partSource === "donor" ? "— Donor part selected —" : "— Select inventory item —"}</option>
              {invItems.map((i) => (
                <option key={i.id} value={i.id}>{i.sku ? `${i.sku} · ` : ""}{i.name} (Stock: {i.quantity})</option>
              ))}
            </select>
            {partBatch && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Will deduct from batch <span className="font-mono">{partBatch.code}</span></p>
            )}
            <p className="text-xs text-gray-400 mt-1">Cost is recorded automatically from the batch (FIFO) or Donor value.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
            <input type="number" min="1" required value={partQty} onChange={(e) => setPartQty(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setPartJob(null)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={savingPart}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {savingPart ? "Saving…" : "Log Part"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
