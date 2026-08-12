import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
import ScanField from "../../components/ScanField";
import TechJobDetailModal from "./TechJobDetailModal";

const STATUS_OPTIONS = [
  { value: "in_progress",      label: "Mark In Progress" },
  { value: "completed",        label: "Mark Completed" },
];

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function TechDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs]             = useState([]);
  const [donors, setDonors]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedDonor, setSelectedDonor] = useState(null);

  // Job Details Modal
  const [detailJob, setDetailJob] = useState(null);

  const [now, setNow]               = useState(new Date());

  // Part logging
  const [partJob, setPartJob]       = useState(null);
  const [invItems, setInvItems]     = useState([]);
  const [partItemId, setPartItemId] = useState("");
  const [partBatch, setPartBatch]   = useState(null); // { id, code } from a scan
  const [partQty, setPartQty]       = useState(1);
  const [partError, setPartError]   = useState("");
  const [partInfo, setPartInfo]     = useState("");
  const [savingPart, setSavingPart] = useState(false);
  const [partLoggedCounter, setPartLoggedCounter] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMyJobs = async () => {
    try {
      const [jobsRes, donorsRes] = await Promise.all([
        api.get("/jobs/mine"),
        api.get("/donors/")
      ]);
      setJobs(jobsRes.data);
      setDonors(donorsRes.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyJobs(); }, []);

  const myJobs    = jobs.filter((j) => j.technician_id === user?.id);
  const unclaimed = jobs.filter((j) => !j.technician_id);

  const myDonors = donors.filter((d) => d.assigned_technician_id === user?.id);
  const unclaimedDonors = donors.filter((d) => !d.assigned_technician_id && d.status === "available");

  const handleClaim = async (job) => {
    setClaimingId(job.id);
    try {
      await api.patch(`/jobs/${job.id}/claim`);
      setSelectedJob(null);
      await fetchMyJobs();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to claim job");
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimDonor = async (donor) => {
    setClaimingId(donor.id);
    try {
      await api.patch(`/donors/${donor.id}/claim`);
      setSelectedDonor(null);
      await fetchMyJobs();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to claim donor device");
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
    setPartError(""); setPartInfo("");
    try {
      const { data } = await api.get(`/inventory/scan/${encodeURIComponent(code)}`);
      setPartItemId(data.item.id);
      if (data.batch) {
        setPartBatch({ id: data.batch.id, code: data.batch.batch_code });
        setPartInfo(`Matched ${data.item.name} · batch ${data.batch.batch_code} (${data.batch.quantity_remaining} left)`);
      } else {
        setPartBatch(null);
        setPartInfo(`Matched ${data.item.name} · ${data.item.quantity} in stock (FIFO)`);
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
      await api.post(`/jobs/${partJob.id}/parts`, {
        part_source: "inventory",
        inventory_item_id: partItemId || null,
        batch_id: partBatch?.id || null,
        quantity: parseInt(partQty, 10),
      });
      setPartJob(null);
      setPartLoggedCounter((prev) => prev + 1);
    } catch (err) {
      setPartError(err.response?.data?.detail || "Failed to log part");
    } finally {
      setSavingPart(false);
    }
  };
  const pending     = myJobs.filter((j) => j.status === "pending").length;
  const inProgress  = myJobs.filter((j) => j.status === "in_progress").length;
  const today       = now.toDateString();
  const doneToday   = myJobs.filter((j) =>
    j.status === "completed" && j.completed_date && new Date(j.completed_date).toDateString() === today
  ).length;

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard label="Assigned to Me"  value={loading ? "…" : pending}          color="text-blue-600" />
        <StatCard label="In Progress"     value={loading ? "…" : inProgress}       color="text-amber-600" />
        <StatCard label="Completed Today" value={loading ? "…" : doneToday}        color="text-green-600" />
        <StatCard label="Unclaimed Jobs"  value={loading ? "…" : unclaimed.length} color="text-purple-600" />
      </div>

      {/* Unclaimed jobs — compact, click a card for details */}
      {!loading && unclaimed.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Available Jobs — tap to view &amp; claim
            </h3>
            <span className="text-xs text-amber-600">{unclaimed.length} unclaimed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {unclaimed.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="text-left bg-white border border-amber-100 hover:border-amber-300 hover:shadow-sm rounded-lg px-3 py-2.5 transition-all"
              >
                <p className="font-mono text-xs font-semibold text-blue-600 truncate">{job.job_id}</p>
                <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{job.device_brand} {job.device_model}</p>
                <p className="text-xs text-gray-400 capitalize truncate">{job.fault_category?.replace(/_/g, " ")}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unclaimed Donor Devices */}
      {!loading && unclaimedDonors.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-800 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Available Donor Devices — tap to view &amp; claim
            </h3>
            <span className="text-xs text-green-600">{unclaimedDonors.length} unclaimed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {unclaimedDonors.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDonor(d)}
                className="text-left bg-white border border-green-100 hover:border-green-300 hover:shadow-sm rounded-lg px-3 py-2.5 transition-all"
              >
                <p className="font-mono text-xs font-semibold text-green-600 truncate">{d.brand} {d.model}</p>
                <p className="text-sm font-medium text-gray-800 truncate mt-0.5">Condition: {d.condition}</p>
                <p className="text-xs text-gray-400 capitalize truncate">{d.source?.replace(/_/g, " ")}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">My Job Queue</h3>
          <Link to="/tech/jobs" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : myJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="font-medium text-gray-500">No jobs claimed yet</p>
            <p className="text-sm mt-1">Claim an available job above to get started</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Job ID", "Device", "Fault", "Status", "Est. Ready"].map((h, i) => (
                  <th key={i} className="text-left pb-2.5 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myJobs.slice(0, 8).map((job) => (
                <tr 
                  key={job.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setDetailJob(job)}
                >
                  <td className="py-2.5 font-mono text-xs text-blue-600 font-semibold">{job.job_id}</td>
                  <td className="py-2.5 text-gray-700">{job.device_brand} {job.device_model}</td>
                  <td className="py-2.5 text-gray-500 capitalize text-xs">{job.fault_category?.replace(/_/g, " ")}</td>
                  <td className="py-2.5"><JobStatusBadge status={job.status} /></td>
                  <td className="py-2.5 text-gray-400 text-xs">
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

      {/* My Donor Devices Queue */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">My Claimed Donor Devices</h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : myDonors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="font-medium text-gray-500">No donor devices claimed yet</p>
            <p className="text-sm mt-1">Claim an available donor device above to strip parts</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Device", "Condition", "Source", "Status", "Registered"].map((h, i) => (
                  <th key={i} className="text-left pb-2.5 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myDonors.map((d) => (
                <tr 
                  key={d.id} 
                  onClick={() => navigate('/tech/donors')}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 font-semibold text-gray-800">{d.brand} {d.model}</td>
                  <td className="py-2.5 text-gray-600 capitalize text-xs">{d.condition}</td>
                  <td className="py-2.5 text-gray-500 capitalize text-xs">{d.source?.replace(/_/g, " ")}</td>
                  <td className="py-2.5"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-semibold uppercase">{d.status}</span></td>
                  <td className="py-2.5 text-gray-400 text-xs">
                    {d.added_date ? new Date(d.added_date).toLocaleDateString("en-LK") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Unclaimed job details + claim */}
      <Modal open={!!selectedJob} onClose={() => setSelectedJob(null)} title={`Job ${selectedJob?.job_id || ""}`}>
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
                <p className="font-medium text-gray-800">{selectedJob.device_brand} {selectedJob.device_model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Fault</p>
                <p className="font-medium text-gray-800 capitalize">{selectedJob.fault_category?.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-medium text-gray-800">{selectedJob.customer_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Est. Ready</p>
                <p className="font-medium text-gray-800">
                  {selectedJob.estimated_completion_date
                    ? new Date(selectedJob.estimated_completion_date).toLocaleDateString("en-LK")
                    : "—"}
                </p>
              </div>
            </div>

            {selectedJob.fault_description && (
              <div>
                <p className="text-xs text-gray-400">Description</p>
                <p className="text-sm text-gray-700">{selectedJob.fault_description}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
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

      {/* Unclaimed donor device details + claim */}
      <Modal open={!!selectedDonor} onClose={() => setSelectedDonor(null)} title="Claim Donor Device">
        {selectedDonor && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                Available to Claim
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Device</p>
                <p className="font-medium text-gray-800">{selectedDonor.brand} {selectedDonor.model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Condition</p>
                <p className="font-medium text-gray-800 capitalize">{selectedDonor.condition}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Source</p>
                <p className="font-medium text-gray-800 capitalize">{selectedDonor.source?.replace(/_/g, " ")}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedDonor(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleClaimDonor(selectedDonor)}
                disabled={claimingId === selectedDonor.id}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {claimingId === selectedDonor.id ? "Claiming…" : "Claim Device"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <TechJobDetailModal 
        open={!!detailJob} 
        job={detailJob} 
        onClose={() => setDetailJob(null)} 
        onDone={() => { setDetailJob(null); fetchMyJobs(); }} 
        onOpenPartLog={openLogPart} 
        partRefreshTrigger={partLoggedCounter}
      />

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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Scan part label</label>
            <ScanField onCode={handleScan} placeholder="Scan QR / SKU / batch code" />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-gray-400">or pick manually</span></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Inventory Part *</label>
            <select required value={partItemId} onChange={(e) => { setPartItemId(e.target.value); setPartBatch(null); setPartInfo(""); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select inventory item —</option>
              {invItems.map((i) => (
                <option key={i.id} value={i.id}>{i.sku ? `${i.sku} · ` : ""}{i.name} (Stock: {i.quantity})</option>
              ))}
            </select>
            {partBatch && (
              <p className="text-xs text-gray-500 mt-1">Will deduct from batch <span className="font-mono">{partBatch.code}</span></p>
            )}
            <p className="text-xs text-gray-400 mt-1">Cost is recorded automatically from the batch (FIFO).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
            <input type="number" min="1" required value={partQty} onChange={(e) => setPartQty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setPartJob(null)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
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
