import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const HISTORY_COLORS = {
  pending:          "bg-gray-400",
  in_progress:      "bg-blue-500",
  completed:        "bg-purple-500",
  ready_for_pickup: "bg-amber-500",
  delivered:        "bg-green-500",
  unclaimed:        "bg-red-500",
};

export default function AdminJobDetailModal({ open, jobId, onClose, onDone }) {
  const [job, setJob]           = useState(null);
  const [parts, setParts]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [invoice, setInvoice]   = useState(null);
  const [loading, setLoading]   = useState(true);

  // Add part modal
  const [showPart, setShowPart]         = useState(false);
  const [invItems, setInvItems]         = useState([]);
  const [partSource, setPartSource]     = useState("inventory");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [quantity, setQuantity]         = useState(1);
  const [unitCost, setUnitCost]         = useState("");
  const [actualCost, setActualCost]     = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [partError, setPartError]       = useState("");
  const [savingPart, setSavingPart]     = useState(false);

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [laborCost, setLaborCost]     = useState("");
  const [taxRate, setTaxRate]         = useState("0");
  const [invError, setInvError]       = useState("");
  const [savingInv, setSavingInv]     = useState(false);

  // Pay modal
  const [showPay, setShowPay]     = useState(false);
  const [payMethod, setPayMethod] = useState("cash");

  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Revert request handling
  const [processingRevert, setProcessingRevert] = useState(false);

  // Warranty Claim modal
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [warrantyFault, setWarrantyFault]         = useState("");
  const [warrantyTechId, setWarrantyTechId]       = useState("");
  const [warrantyNotes, setWarrantyNotes]         = useState("");
  const [technicians, setTechnicians]             = useState([]);
  const [savingWarranty, setSavingWarranty]       = useState(false);
  const [warrantyError, setWarrantyError]         = useState("");

  const openWarrantyModal = async () => {
    setWarrantyFault(job?.fault_description || "");
    setWarrantyTechId(job?.technician_id || "");
    setWarrantyNotes("");
    setWarrantyError("");
    try {
      const { data } = await api.get("/users/", { params: { role: "technician" } });
      setTechnicians(data);
    } catch {
      setTechnicians([]);
    }
    setShowWarrantyModal(true);
  };

  const handleCreateWarrantyClaim = async (e) => {
    e.preventDefault();
    setWarrantyError("");
    setSavingWarranty(true);
    try {
      const payload = {
        customer_id: job.customer_id,
        technician_id: warrantyTechId || null,
        rework_of_job_id: job.id,
        device_brand: job.device_brand,
        device_model: job.device_model,
        device_imei: job.device_imei,
        fault_category: job.fault_category,
        fault_description: warrantyFault.trim() || job.fault_description,
        estimated_cost: 0,
        notes: warrantyNotes ? `[Warranty Claim for ${job.job_id}] ${warrantyNotes}` : `[Warranty Claim for ${job.job_id}]`,
      };
      await api.post("/jobs/", payload);
      setShowWarrantyModal(false);
      alert(`Warranty Claim registered successfully for Job #${job.job_id}!`);
      onDone?.();
      onClose();
    } catch (err) {
      setWarrantyError(err.response?.data?.detail || "Failed to register Warranty Claim");
    } finally {
      setSavingWarranty(false);
    }
  };

  const handleApproveRevert = async () => {
    setProcessingRevert(true);
    try {
      await api.post(`/jobs/${job.id}/revert-approve`);
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve revert");
    } finally {
      setProcessingRevert(false);
    }
  };

  const handleRejectRevert = async () => {
    if (!window.confirm("Are you sure you want to reject this revert request?")) return;
    setProcessingRevert(true);
    try {
      await api.post(`/jobs/${job.id}/revert-reject`);
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reject revert");
    } finally {
      setProcessingRevert(false);
    }
  };

  const fetchAll = async () => {
    if (!open || !jobId) return;
    setLoading(true);
    try {
      const [jobRes, partsRes, historyRes, invoiceRes] = await Promise.allSettled([
        api.get(`/jobs/${jobId}`),
        api.get(`/jobs/${jobId}/parts`),
        api.get(`/jobs/${jobId}/history`),
        api.get(`/jobs/${jobId}/invoice`),
      ]);
      if (jobRes.status === "fulfilled")     setJob(jobRes.value.data);
      if (partsRes.status === "fulfilled")   setParts(partsRes.value.data);
      if (historyRes.status === "fulfilled") setHistory(historyRes.value.data);
      if (invoiceRes.status === "fulfilled" && invoiceRes.value.data)
        setInvoice(invoiceRes.value.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [jobId, open]);

  const openAddPart = async () => {
    setPartError(""); setSelectedItem(""); setSelectedBatchId(""); setQuantity(1); setUnitCost(""); setActualCost(""); setOverridePrice(""); setPartSource("inventory");
    try {
      const { data } = await api.get("/inventory/", { params: {} });
      setInvItems(data.filter((i) => i.quantity > 0));
    } catch { setInvItems([]); }
    setShowPart(true);
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    setPartError("");
    setSavingPart(true);
    try {
      const payload = {
        part_source: partSource,
        inventory_item_id: partSource === "inventory" ? selectedItem || null : null,
        donor_part_id: partSource === "donor" ? selectedItem || null : null,
        quantity: parseInt(quantity, 10),
        unit_cost: partSource === "donor" ? parseFloat(unitCost) : null,
      };
      if (selectedBatchId) {
        payload.batch_id = selectedBatchId;
      }
      if (overridePrice) {
        payload.override_price = parseFloat(overridePrice);
      }
      await api.post(`/jobs/${jobId}/parts`, payload);
      setShowPart(false);
      fetchAll();
    } catch (err) {
      setPartError(err.response?.data?.detail || "Failed to add part");
    } finally {
      setSavingPart(false);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setInvError("");
    setSavingInv(true);
    try {
      await api.post("/invoices/", {
        job_id: jobId,
        labor_cost: parseFloat(laborCost) || 0,
        tax_rate: parseFloat(taxRate) || 0,
      });
      setShowInvoice(false);
      fetchAll();
    } catch (err) {
      setInvError(err.response?.data?.detail || "Failed to generate invoice");
    } finally {
      setSavingInv(false);
    }
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/invoices/${invoice.id}/pay`, { payment_method: payMethod });
      setShowPay(false);
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed");
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!newStatus) return;
    setSavingStatus(true);
    try {
      await api.patch(`/jobs/${jobId}/status`, { status: newStatus, notes: statusNotes });
      setNewStatus("");
      setStatusNotes("");
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const partsTotal = parts.reduce((sum, p) => sum + Number(p.unit_price) * p.quantity, 0);

  const previewSub = () => {
    const labor = parseFloat(laborCost) || 0;
    const tax = parseFloat(taxRate) || 0;
    const sub = partsTotal + labor;
    const taxAmt = (sub * tax) / 100;
    return { sub, taxAmt, total: sub + taxAmt };
  };

  if (!job && !loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Job not found.</p>
          <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Close</button>
        </div>
      </div>
    );
  }

  const { sub, taxAmt, total } = loading ? { sub: 0, taxAmt: 0, total: 0 } : previewSub();

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto relative">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Job Detail & Management</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Job ID: {job?.job_id || "Loading..."}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none">&times;</button>
        </div>

        <div className="p-8 space-y-6">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-20">Loading job details…</div>
          ) : (
            <>

      {job.revert_requested_to && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-amber-800 font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Revert Request Pending
              </h3>
              <p className="text-amber-700 text-sm mt-1">
                Technician requested to revert the status back to <b>{job.revert_requested_to.replace(/_/g, " ")}</b>.
              </p>
              {job.revert_reason && (
                <p className="text-amber-700 text-sm italic mt-1 bg-amber-100/50 p-2 rounded w-fit">"{job.revert_reason}"</p>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleRejectRevert}
                disabled={processingRevert}
                className="bg-white dark:bg-gray-800 text-amber-700 border border-amber-300 hover:bg-amber-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button 
                onClick={handleApproveRevert}
                disabled={processingRevert}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                Approve Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warranty Rework Banner if this job is a warranty claim */}
      {job.rework_of_job_id && (
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-purple-900 dark:text-purple-200 font-bold text-sm">
              Warranty Claim / Free Rework Job
            </h3>
            <p className="text-purple-700 dark:text-purple-300 text-xs mt-0.5">
              This repair is a free warranty claim linked to an original repair job.
            </p>
          </div>
          <span className="text-xs bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-mono font-bold px-3 py-1 rounded-lg">
            Free Warranty
          </span>
        </div>
      )}

      {/* Job Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Job ID</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold font-mono text-blue-600">{job.job_id}</p>
              {job.rework_of_job_id && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-purple-200">
                  Warranty Rework
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            {(job.status === "completed" || job.status === "delivered") && (
              <button
                type="button"
                onClick={openWarrantyModal}
                className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors"
                title="Create a free Warranty Claim / Rework Job for this customer"
              >
                Claim Warranty
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Customer</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">{job.customer_name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{job.customer_phone}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Device</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">{job.device_brand} {job.device_model}</p>
            {job.device_imei && <p className="text-gray-500 dark:text-gray-400 text-xs">IMEI: {job.device_imei}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fault</p>
            <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{job.fault_category?.replace(/_/g, " ")}</p>
            {job.fault_description && <p className="text-gray-500 dark:text-gray-400 text-xs">{job.fault_description}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Technician</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">{job.technician_name || "Unassigned"}</p>
            {job.estimated_completion_date && (
              <p className="text-gray-500 dark:text-gray-400 text-xs">Est. {new Date(job.estimated_completion_date).toLocaleDateString("en-LK")}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Estimated Cost</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {job.estimated_cost != null ? `LKR ${Number(job.estimated_cost).toLocaleString()}` : "Not quoted"}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{job.investigated ? "Investigated" : "Not investigated"}</p>
          </div>
        </div>

        {/* Physical Condition & Photos */}
        {(job.physical_condition || (job.images && job.images.length > 0)) && (
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            {job.physical_condition && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Physical Condition</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{job.physical_condition}</p>
              </div>
            )}
            {job.images && job.images.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Condition Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {job.images.map((img) => (
                    <a key={img.id} href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.file_path}`} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.file_path}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" alt="Condition" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parts Used */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200">Parts Used</h3>
          </div>

          {parts.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
              <p className="text-sm text-gray-400">No parts recorded for this job</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {["Part", "Source", "Batch", "Used By", "Qty", "Cost", "Price", "Subtotal"].map((h) => (
                      <th key={h} className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {parts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-medium text-gray-800 dark:text-gray-100">{p.part_name || "—"}</td>
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.part_source === "inventory" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {p.part_source}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.batch_code || "—"}{p.supplier ? <span className="block text-gray-400">{p.supplier}</span> : null}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">{p.used_by_name || "—"}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">{p.quantity}</td>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 line-through text-xs">LKR {Number(p.unit_cost).toLocaleString()}</td>
                      <td className="py-2.5 text-gray-800 dark:text-gray-100 font-medium">LKR {Number(p.unit_price).toLocaleString()}</td>
                      <td className="py-2.5 font-bold text-gray-800 dark:text-gray-100">LKR {(Number(p.unit_price) * p.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Parts Total: LKR {partsTotal.toLocaleString()}</p>
              </div>
            </>
          )}
        </div>

        {/* Right column: Invoice + History */}
        <div className="space-y-6">
          {/* Status History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Status History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">No history recorded</p>
            ) : (
              <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-4 ml-2">
                {history.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className={`absolute -left-1.5 mt-1 w-3 h-3 rounded-full ${HISTORY_COLORS[h.status] ?? "bg-gray-400"}`} />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 capitalize">{h.status.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400">{h.changed_by_name}</p>
                    {h.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">{h.notes}</p>}
                    <p className="text-xs text-gray-300 mt-0.5">
                      {h.created_at ? new Date(h.created_at).toLocaleString("en-LK") : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Status Update Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Update Status</h3>
            {job.status === "pending" || job.status === "in_progress" ? (
              <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-lg">
                This job is currently <strong>{job.status.replace("_", " ")}</strong>. Admins cannot update its status to Ready or Delivered until the technician marks it as Completed.
              </div>
            ) : (
              <form onSubmit={handleUpdateStatus} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="" disabled>— Select Status —</option>
                    {[
                      { value: "ready_for_pickup", label: "Ready for Pickup", order: 3 },
                      { value: "delivered",        label: "Delivered",        order: 4 },
                      { value: "unclaimed",        label: "Unclaimed",        order: 4 }
                    ].map((s) => {
                      const currentOrder = { completed: 2, ready_for_pickup: 3, delivered: 4, unclaimed: 4 }[job.status] || 0;
                      let isOptionDisabled = s.order <= currentOrder;
                      
                      // Allow switching between delivered and unclaimed
                      if ((job.status === "delivered" && s.value === "unclaimed") || 
                          (job.status === "unclaimed" && s.value === "delivered")) {
                        isOptionDisabled = false;
                      }

                      if (s.value === "delivered") {
                        const isPaid = invoice && invoice.payment_status === "paid";
                        if (!isPaid) {
                          isOptionDisabled = true;
                        }
                      }
                      return (
                        <option key={s.value} value={s.value} disabled={isOptionDisabled}>
                          {s.label} {s.value === "delivered" && !isOptionDisabled ? "" : (s.value === "delivered" ? "(Requires Payment)" : "")}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
                  <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={2}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Reason for change..." />
                </div>
                <button type="submit" disabled={savingStatus || !newStatus}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
                  {savingStatus ? "Updating…" : "Update Status"}
                </button>
              </form>
            )}
          </div>

          {/* Invoice */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Invoice</h3>
            {!invoice ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">No invoice generated yet.</p>
                <button
                  onClick={() => { setInvError(""); setLaborCost(job.labor_cost || ""); setTaxRate("0"); setShowInvoice(true); }}
                  disabled={job.status !== "ready_for_pickup"}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                >
                  Generate Invoice
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Subtotal</span><span>LKR {Number(invoice.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Tax</span><span>LKR {Number(invoice.tax_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-800 dark:text-gray-100 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                  <span>Total</span><span>LKR {Number(invoice.total_amount).toLocaleString()}</span>
                </div>
                <div className="pt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    invoice.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {invoice.payment_status}
                  </span>
                  {invoice.payment_method && (
                    <span className="ml-2 text-xs text-gray-400">via {invoice.payment_method}</span>
                  )}
                </div>
                {invoice.payment_status !== "paid" && (
                  <button
                    onClick={() => { setPayMethod("cash"); setShowPay(true); }}
                    className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Part Modal */}
      <Modal open={showPart} onClose={() => setShowPart(false)} title="Add Part to Job">
        <form onSubmit={handleAddPart} className="space-y-4">
          {partError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{partError}</div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Part Source</label>
            <select value={partSource} onChange={(e) => { setPartSource(e.target.value); setSelectedItem(""); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="inventory">Inventory Stock</option>
              <option value="donor">Donor Part</option>
            </select>
          </div>

          {partSource === "inventory" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select Part *</label>
                <select required value={selectedItem} onChange={(e) => {
                  setSelectedItem(e.target.value);
                  setSelectedBatchId("");
                  const item = invItems.find((i) => i.id === e.target.value);
                  if (item) {
                    setOverridePrice(item.unit_price?.toString() || "");
                    // If batches are available in the response, get the cost of the oldest available batch
                    // Currently invItems list may not have full batch data, so we can display what's known or leave it empty if not.
                    if (item.batches && item.batches.length > 0) {
                       setActualCost(item.batches.filter(b => b.quantity_remaining > 0)[0]?.unit_cost || item.batches[item.batches.length-1].unit_cost);
                    } else {
                       setActualCost("Hidden (Load from oldest batch)");
                    }
                  }
                }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select inventory item —</option>
                  {invItems.map((i) => (
                    <option key={i.id} value={i.id}>{i.sku ? `${i.sku} · ` : ""}{i.name} (Stock: {i.quantity})</option>
                  ))}
                </select>
                {selectedItem && (() => {
                  const item = invItems.find((i) => i.id === selectedItem);
                  if (item && item.batches && item.batches.length > 0) {
                    return (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select Specific Batch (Optional)</label>
                        <select value={selectedBatchId} onChange={(e) => {
                          const bid = e.target.value;
                          setSelectedBatchId(bid);
                          if (bid) {
                            const b = item.batches.find(b => b.id === bid);
                            if (b) setActualCost(b.unit_cost);
                          } else {
                            setActualCost(item.batches.filter(b => b.quantity_remaining > 0)[0]?.unit_cost || item.batches[item.batches.length-1].unit_cost);
                          }
                        }}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Auto-Select (Oldest First)</option>
                          {item.batches.filter(b => b.quantity_remaining > 0).map(b => (
                            <option key={b.id} value={b.id}>{b.batch_code} — LKR {b.unit_cost} ({b.quantity_remaining} left)</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}
                {selectedItem && (
                   <p className="text-xs text-orange-600 mt-1 font-medium">Est. Unit Cost: {actualCost === "Hidden (Load from oldest batch)" ? actualCost : `LKR ${actualCost}`}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Final Selling Price (LKR) *</label>
                <input type="number" step="0.01" min="0" required value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
                <p className="text-xs text-gray-400 mt-1">Lower this value to give the customer a discount.</p>
              </div>
            </>
          )}

          {partSource === "donor" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Donor Part ID</label>
              <input value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}
                placeholder="Paste donor part UUID"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
              <input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {partSource === "donor" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Unit Cost (LKR) *</label>
                <input type="number" min="0" step="0.01" required value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPart(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={savingPart}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {savingPart ? "Adding…" : "Add Part"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal open={showInvoice} onClose={() => setShowInvoice(false)} title="Generate Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {invError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{invError}</div>
          )}
          <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700">
            Parts total: <strong>LKR {partsTotal.toLocaleString()}</strong>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Labor Cost (LKR)</label>
              <input type="number" min="0" step="0.01" value={laborCost} onChange={(e) => setLaborCost(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Tax Rate (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Subtotal</span><span>LKR {sub.toLocaleString()}</span></div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Tax ({taxRate}%)</span><span>LKR {taxAmt.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-gray-800 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"><span>Total</span><span>LKR {total.toFixed(2)}</span></div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowInvoice(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={savingInv}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {savingInv ? "Generating…" : "Generate Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal open={showPay} onClose={() => setShowPay(false)} title="Mark Invoice as Paid">
        <form onSubmit={handleMarkPaid} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Total: <strong>LKR {Number(invoice?.total_amount || 0).toLocaleString()}</strong>
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Payment Method</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPay(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold">
              Confirm Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Warranty Claim Modal */}
      <Modal open={showWarrantyModal} onClose={() => setShowWarrantyModal(false)} title="Create Customer Warranty Claim (Rework)">
        <form onSubmit={handleCreateWarrantyClaim} className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200">
            <p className="font-bold mb-0.5">Free Guarantee Repair for Job #{job?.job_id}</p>
            <p>Customer: <strong>{job?.customer_name}</strong> ({job?.device_brand} {job?.device_model})</p>
          </div>

          {warrantyError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
              {warrantyError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              New Issue / Claim Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={warrantyFault}
              onChange={(e) => setWarrantyFault(e.target.value)}
              placeholder="Describe the defect or reason for warranty claim (e.g. Touch stopped working after 2 days)..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Assign Technician for Warranty Repair
            </label>
            <select
              value={warrantyTechId}
              onChange={(e) => setWarrantyTechId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Assign Later --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Additional Internal Notes (Optional)
            </label>
            <input
              type="text"
              value={warrantyNotes}
              onChange={(e) => setWarrantyNotes(e.target.value)}
              placeholder="e.g. Free replacement under 30-day screen warranty"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowWarrantyModal(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingWarranty}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 rounded-lg text-sm font-semibold shadow-sm"
            >
              {savingWarranty ? "Registering Claim…" : "Register Warranty Job"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )}
</div>
</div>
</div>
);
}
