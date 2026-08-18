import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
import BrandSelect from "../../components/BrandSelect";
import ModelSelect from "../../components/ModelSelect";
import AdminJobDetailModal from "./AdminJobDetailModal";
import SmartPartsPanel from "../../components/SmartPartsPanel";

// ─── helpers ──────────────────────────────────────────────────────────────────

const FAULT_CATEGORIES = [
  { value: "screen",        label: "Screen" },
  { value: "battery",       label: "Battery" },
  { value: "charging_port", label: "Charging Port" },
  { value: "camera",        label: "Camera" },
  { value: "speaker",       label: "Speaker" },
  { value: "software",      label: "Software / OS" },
  { value: "water_damage",  label: "Water Damage" },
  { value: "other",         label: "Other" },
];

const STATUS_TABS = [
  { value: "",                label: "All" },
  { value: "pending",         label: "Pending" },
  { value: "in_progress",     label: "In Progress" },
  { value: "completed",       label: "Completed" },
  { value: "failed",          label: "Failed" },
  { value: "rejected",        label: "Rejected" },
  { value: "ready_for_pickup",label: "Ready" },
  { value: "delivered",       label: "Delivered" },
  { value: "unclaimed",       label: "Unclaimed" },
];

const STATUS_OPTIONS = [
  { value: "pending",          label: "Pending" },
  { value: "in_progress",      label: "In Progress" },
  { value: "completed",        label: "Completed" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "delivered",        label: "Delivered" },
  { value: "unclaimed",        label: "Unclaimed" },
];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getEmptyForm = () => ({
  customer_id: "", technician_id: "",
  device_brand: "", device_model: "", device_imei: "",
  fault_category: "screen", fault_description: "",
  estimated_completion_date: getTodayDateString(), estimated_cost: "", investigated: false, notes: "", physical_condition: "",
});

function ConditionPhotoUploader({ photos, setPhotos }) {
  const [mode, setMode] = useState("upload");
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(s);
      setMode("camera");
    } catch (err) {
      alert("Camera not available: " + err.message);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setMode("upload");
  };

  useEffect(() => {
    if (mode === "camera" && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [mode, stream]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      const preview = URL.createObjectURL(file);
      setPhotos(p => [...p, { file, preview, type: "camera" }]);
    }, "image/jpeg", 0.8);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      file, preview: URL.createObjectURL(file), type: "upload"
    }));
    setPhotos(p => [...p, ...newPhotos]);
  };

  const removePhoto = (index) => {
    setPhotos(p => {
      const copy = [...p];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  return (
    <div className="space-y-3">
      {mode === "camera" ? (
        <div className="relative rounded-lg overflow-hidden bg-black flex flex-col items-center">
          <video ref={videoRef} autoPlay playsInline className="max-h-64 object-contain w-full" />
          <div className="absolute bottom-2 flex gap-2">
            <button type="button" onClick={capturePhoto} className="bg-white dark:bg-gray-800 text-black px-4 py-1.5 rounded-full font-bold shadow-lg">Snap Photo</button>
            <button type="button" onClick={stopCamera} className="bg-red-600 text-white px-4 py-1.5 rounded-full font-bold shadow-lg">Close</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={startCamera} className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-blue-200">
            📷 Open Camera
          </button>
          <label className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-200 cursor-pointer">
            📁 Upload Files
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}
      
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-2">
          {photos.map((p, i) => (
            <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <img src={p.preview} className="w-full h-full object-cover" alt="" />
              <button type="button" onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs m-0.5 rounded-full leading-none">&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, wide, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Smart Parts Panel ────────────────────────────────────────────────────────

// ─── Quick Quote Estimator ────────────────────────────────────────────────────

function QuoteModal({ open, onClose }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [parts, setParts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({}); // { [id]: { qty, unit_price, name } }
  const [labor, setLabor] = useState("");

  useEffect(() => {
    if (open) {
      setBrand(""); setModel(""); setParts(null); setSelected({}); setLabor("");
    }
  }, [open]);

  const findParts = async () => {
    if (!brand.trim() || !model.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get("/inventory/suggest", { params: { brand, model } });
      setParts(data);
    } catch {
      setParts({ inventory_parts: [], donor_parts: [] });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (p) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = { qty: 1, unit_price: Number(p.unit_price), name: p.name };
      return next;
    });
  };

  const setQty = (id, qty) =>
    setSelected((s) => ({ ...s, [id]: { ...s[id], qty: Math.max(1, Number(qty) || 1) } }));

  const partsSubtotal = Object.values(selected).reduce((sum, p) => sum + p.unit_price * p.qty, 0);
  const laborNum = labor === "" ? 0 : Number(labor) || 0;
  const total = partsSubtotal + laborNum;

  return (
    <Modal open={open} onClose={onClose} title="Quick Quote Estimator" wide>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Give a customer a rough price without opening a job. Pick the device, select the parts
        likely needed, add a labour charge, and read off the estimated total.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Device Brand</label>
          <BrandSelect value={brand} onChange={(v) => { setBrand(v); setModel(""); setParts(null); setSelected({}); }} placeholder="Samsung" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Device Model</label>
          <ModelSelect brand={brand} value={model} onChange={(v) => { setModel(v); setParts(null); setSelected({}); }} placeholder="Galaxy A54" />
        </div>
      </div>

      <button
        type="button"
        onClick={findParts}
        disabled={!brand.trim() || !model.trim() || loading}
        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1.5 rounded-lg font-medium transition-colors mb-4"
      >
        {loading ? "Checking…" : "Find Compatible Parts"}
      </button>

      {parts !== null && (
        <div className="mb-4">
          {parts.inventory_parts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No priced inventory parts found for {brand} {model}. You can still give a labour-only estimate below.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select parts to include in the estimate</p>
              {parts.inventory_parts.map((p) => {
                const sel = selected[p.id];
                return (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!sel}
                        onChange={() => toggle(p)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-800 dark:text-gray-100">{p.name}</span>
                      <span className="text-xs text-gray-400">({p.part_type === "salvaged" ? "salvaged" : "new"}, stock {p.quantity})</span>
                    </label>
                    <div className="flex items-center gap-3">
                      {sel && (
                        <input
                          type="number"
                          min="1"
                          value={sel.qty}
                          onChange={(e) => setQty(p.id, e.target.value)}
                          className="w-14 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
                        />
                      )}
                      <span className="text-gray-600 dark:text-gray-300 w-28 text-right">LKR {Number(p.unit_price).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {parts.donor_parts.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              {parts.donor_parts.length} salvaged donor part(s) also available — a lower-cost alternative you can mention.
            </p>
          )}
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Parts subtotal</span>
          <span className="font-semibold text-gray-700 dark:text-gray-200">LKR {partsSubtotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-500 dark:text-gray-400">Labour charge (LKR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={labor}
            onChange={(e) => setLabor(e.target.value)}
            placeholder="0"
            className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-right"
          />
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-base font-bold text-gray-800 dark:text-gray-100">Estimated Total</span>
          <span className="text-base font-bold text-blue-700">LKR {total.toLocaleString()}</span>
        </div>
        <p className="text-[11px] text-gray-400">Indicative only — final price may change after the device is investigated.</p>
      </div>
    </Modal>
  );
}

function RevertApprovalModal({ open, job, onClose, onDone }) {
  const [saving, setSaving] = useState(false);

  if (!job) return null;

  const handleAction = async (action) => {
    setSaving(true);
    try {
      await api.post(`/jobs/${job.id}/revert-${action}`);
      onDone();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} revert`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Review Revert Request — ${job.job_id}`}>
      <div className="space-y-4">
        <div className="bg-amber-50 p-4 rounded-lg text-sm text-amber-900 border border-amber-200">
          <p><strong>Target Status:</strong> {job.revert_requested_to}</p>
          <p className="mt-2"><strong>Reason:</strong> {job.revert_reason}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => handleAction('reject')} disabled={saving}
            className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
            Reject Revert
          </button>
          <button type="button" onClick={() => handleAction('approve')} disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 rounded-lg text-sm font-semibold">
            {saving ? "Processing…" : "Approve Revert"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Invoice / Repair Receipt with QR ─────────────────────────────────────────

const SHOP = {
  name: "ServiceSync",
  tagline: "Phone Repair Service",
  address: "123 Galle Road, Colombo 03",
  phone: "+94 11 234 5678",
};

const fmtFault = (s) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" }) : "—");

function InvoiceReceipt({ job, onClose }) {
  const [qr, setQr] = useState("");
  const trackUrl = `${window.location.origin}/track/${job.job_id}`;

  useEffect(() => {
    QRCode.toDataURL(trackUrl, { width: 220, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [trackUrl]);

  const handlePrint = () => {
    const win = window.open("", "PrintInvoice", "width=440,height=680");
    if (!win) {
      alert("Please allow pop-ups to print the invoice.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Invoice ${job.job_id}</title>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1f2937; margin: 0; padding: 24px; }
        .wrap { max-width: 360px; margin: 0 auto; }
        .center { text-align: center; }
        .brand { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -.5px; }
        .muted { color: #6b7280; font-size: 12px; }
        .divider { border: none; border-top: 1px dashed #d1d5db; margin: 14px 0; }
        .jobid { font-size: 20px; font-weight: 800; letter-spacing: 1px; margin: 4px 0; }
        table { width: 100%; font-size: 12px; border-collapse: collapse; }
        td { padding: 4px 0; vertical-align: top; }
        td.k { color: #6b7280; width: 42%; }
        td.v { font-weight: 600; text-align: right; }
        .qr { margin: 8px auto 4px; }
        .scan { font-size: 12px; font-weight: 600; color: #2563eb; }
        .url { font-size: 10px; color: #9ca3af; word-break: break-all; }
        .foot { font-size: 11px; color: #9ca3af; margin-top: 10px; }
      </style></head><body>
      <div class="wrap">
        <div class="center">
          <div class="brand">${SHOP.name}</div>
          <div class="muted">${SHOP.tagline}</div>
          <div class="muted">${SHOP.address}</div>
          <div class="muted">${SHOP.phone}</div>
        </div>
        <hr class="divider" />
        <div class="center">
          <div class="muted">REPAIR JOB / RECEIPT</div>
          <div class="jobid">${job.job_id}</div>
          <div class="muted">${fmtDate(job.received_date || new Date())}</div>
        </div>
        <hr class="divider" />
        <table>
          <tr><td class="k">Customer</td><td class="v">${job.customer_name || "—"}</td></tr>
          <tr><td class="k">Phone</td><td class="v">${job.customer_phone || "—"}</td></tr>
          <tr><td class="k">Device</td><td class="v">${job.device_brand} ${job.device_model}</td></tr>
          ${job.device_imei ? `<tr><td class="k">IMEI</td><td class="v">${job.device_imei}</td></tr>` : ""}
          <tr><td class="k">Fault</td><td class="v">${fmtFault(job.fault_category)}</td></tr>
          ${job.fault_description ? `<tr><td class="k">Details</td><td class="v">${job.fault_description}</td></tr>` : ""}
          <tr><td class="k">Est. Ready</td><td class="v">${fmtDate(job.estimated_completion_date)}</td></tr>
          ${job.estimated_cost != null ? `<tr><td class="k">Est. Cost</td><td class="v">LKR ${Number(job.estimated_cost).toLocaleString()}</td></tr>` : ""}
        </table>
        <hr class="divider" />
        <div class="center">
          ${qr ? `<img class="qr" src="${qr}" width="180" height="180" alt="QR" />` : ""}
          <div class="scan">Scan to track your repair</div>
          <div class="url">${trackUrl}</div>
        </div>
        <hr class="divider" />
        <div class="center foot">
          Thank you for choosing ${SHOP.name}!<br/>Keep this receipt to collect your device.
          <br/><br/>
          <strong style="color: #4b5563;">Policy:</strong> Devices not collected within 90 days of completion will be considered abandoned and the shop holds no responsibility for loss or damage thereafter.
        </div>
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 350);
  };

  return (
    <Modal open={!!job} onClose={onClose} title="Job Registered — Print Receipt">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
          Job <strong>{job.job_id}</strong> created successfully.
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="text-center">
            <p className="text-lg font-extrabold text-blue-600">{SHOP.name}</p>
            <p className="text-xs text-gray-400">{SHOP.tagline}</p>
          </div>
          <hr className="border-dashed my-3" />
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Repair Job / Receipt</p>
            <p className="text-xl font-bold tracking-wider text-gray-800 dark:text-gray-100 my-1">{job.job_id}</p>
            <p className="text-xs text-gray-400">{fmtDate(job.received_date || new Date())}</p>
          </div>
          <hr className="border-dashed my-3" />
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-400">Customer</span><span className="font-semibold text-gray-700 dark:text-gray-200">{job.customer_name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Phone</span><span className="font-semibold text-gray-700 dark:text-gray-200">{job.customer_phone || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Device</span><span className="font-semibold text-gray-700 dark:text-gray-200">{job.device_brand} {job.device_model}</span></div>
            {job.device_imei && <div className="flex justify-between"><span className="text-gray-400">IMEI</span><span className="font-semibold text-gray-700 dark:text-gray-200">{job.device_imei}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Fault</span><span className="font-semibold text-gray-700 dark:text-gray-200">{fmtFault(job.fault_category)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Est. Ready</span><span className="font-semibold text-gray-700 dark:text-gray-200">{fmtDate(job.estimated_completion_date)}</span></div>
            {job.estimated_cost != null && <div className="flex justify-between"><span className="text-gray-400">Est. Cost</span><span className="font-semibold text-gray-700 dark:text-gray-200">LKR {Number(job.estimated_cost).toLocaleString()}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Investigated</span><span className="font-semibold text-gray-700 dark:text-gray-200">{job.investigated ? "Yes" : "No"}</span></div>
          </div>
          <hr className="border-dashed my-3" />
          <div className="text-center">
            {qr ? (
              <img src={qr} alt="Tracking QR" className="mx-auto w-40 h-40" />
            ) : (
              <div className="w-40 h-40 mx-auto bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-xs text-gray-300">Generating QR…</div>
            )}
            <p className="text-xs font-semibold text-blue-600 mt-1">Scan to track your repair</p>
            <p className="text-[10px] text-gray-400 break-all">{trackUrl}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
            Close
          </button>
          <button type="button" onClick={handlePrint}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold">
            Print Invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobManagement() {
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setFilter]   = useState("");
  const [customers, setCustomers]   = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [form, setForm]             = useState(getEmptyForm);
  const [formError, setFormError]   = useState("");
  const [photos, setPhotos]         = useState([]);
  const [saving, setSaving]         = useState(false);
  const [invoiceJob, setInvoiceJob] = useState(null);
  const [revertJob, setRevertJob]   = useState(null);
  const [detailJobId, setDetailJobId] = useState(null);

  // Customer search state
  const [custSearch, setCustSearch] = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custSearching, setCustSearching] = useState(false);

  // Inline new-customer state
  const [showNewCust, setShowNewCust]   = useState(false);
  const [newCust, setNewCust]           = useState({ name: "", phone_number: "", email: "", address: "" });
  const [custError, setCustError]       = useState("");
  const [creatingCust, setCreatingCust] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const fetchJobs = async (status = statusFilter) => {
    setLoading(true);
    try {
      const { data } = await api.get("/jobs/", { params: status ? { status } : {} });
      setJobs(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportData = async () => {
    try {
      const usersRes = await api.get("/users/");
      setTechnicians(usersRes.data.filter((u) => u.role === "technician"));
    } catch {}
  };

  useEffect(() => { fetchJobs(""); fetchSupportData(); }, []);

  // Auto-open the registration modal when arriving with ?new=1 (e.g. from the dashboard).
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreate(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleTabChange = (status) => {
    setFilter(status);
    fetchJobs(status);
  };

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const searchCustomers = async (q) => {
    setCustSearch(q);
    if (!q.trim()) { setCustResults([]); return; }
    setCustSearching(true);
    try {
      const { data } = await api.get("/customers/", { params: { search: q } });
      setCustResults(data);
    } finally {
      setCustSearching(false);
    }
  };

  const selectCustomer = (c) => {
    setForm((f) => ({ ...f, customer_id: c.id }));
    setCustSearch(`${c.name} — ${c.phone_number}`);
    setCustResults([]);
  };

  const openNewCustomer = () => {
    const term = custSearch.trim();
    const isPhone = /^[0-9+\s-]+$/.test(term);   // prefill phone vs name based on what was typed
    setNewCust({ name: isPhone ? "" : term, phone_number: isPhone ? term : "", email: "", address: "" });
    setCustError("");
    setCustResults([]);
    setShowNewCust(true);
  };

  const handleNewCustChange = (e) =>
    setNewCust((c) => ({ ...c, [e.target.name]: e.target.value }));

  const createInlineCustomer = async () => {
    setCustError("");
    if (!newCust.name.trim() || !newCust.phone_number.trim()) {
      setCustError("Name and phone number are required");
      return;
    }
    setCreatingCust(true);
    try {
      const { data } = await api.post("/customers/", {
        name: newCust.name.trim(),
        phone_number: newCust.phone_number.trim(),
        email: newCust.email.trim() || null,
        address: newCust.address.trim() || null,
      });
      selectCustomer(data);          // sets customer_id + fills the search box
      setShowNewCust(false);
    } catch (err) {
      setCustError(err.response?.data?.detail || "Failed to add customer");
    } finally {
      setCreatingCust(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.customer_id) { setFormError("Please select a customer"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        technician_id: form.technician_id || null,
        device_imei: form.device_imei || null,
        fault_description: form.fault_description || null,
        estimated_completion_date: form.estimated_completion_date || null,
        estimated_cost: form.estimated_cost === "" ? null : Number(form.estimated_cost),
        investigated: form.investigated,
        notes: form.notes || null,
        physical_condition: form.physical_condition || null,
      };
      const { data } = await api.post("/jobs/", payload);
      
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach(p => formData.append("files", p.file));
        await api.post(`/jobs/${data.id}/images`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      setShowCreate(false);
      setForm(getEmptyForm());
      setPhotos([]);
      setCustSearch("");
      fetchJobs(statusFilter);
      setInvoiceJob(data);
    } catch (err) {
      let msg = "Failed to register job";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map(d => `${d.loc.slice(-1)[0]}: ${d.msg}`).join(' | ');
      }
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Job Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{jobs.length} jobs {statusFilter ? `(${statusFilter.replace(/_/g, " ")})` : "total"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuote(true)}
            className="bg-white dark:bg-gray-800 border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Quick Quote
          </button>
          <button
            onClick={() => { setShowCreate(true); setFormError(""); setForm(getEmptyForm()); setPhotos([]); setCustSearch(""); setCustResults([]); setShowNewCust(false); }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Register Job
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              statusFilter === tab.value
                ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mx-4 my-4">
            <p className="font-medium text-gray-500 dark:text-gray-400">No jobs found</p>
            <p className="text-sm text-gray-400 mt-1">
              {statusFilter ? `No jobs with status "${statusFilter.replace(/_/g, " ")}"` : "Register the first job above"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {["Job ID", "Customer", "Device", "Fault", "Status", "Technician", "Received", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {jobs.map((job) => (
                  <tr key={job.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Don't trigger if they clicked a button in the row
                        if (e.target.tagName !== "BUTTON" && !e.target.closest("button")) {
                          setDetailJobId(job.id);
                        }
                      }}>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-600 whitespace-nowrap">{job.job_id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{job.customer_name}</p>
                      <p className="text-xs text-gray-400">{job.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      {job.device_brand} {job.device_model}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize">
                      {job.fault_category?.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.technician_name || <span className="text-gray-300 italic text-xs">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {job.received_date ? new Date(job.received_date).toLocaleDateString("en-LK") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        {job.revert_requested_to ? (
                          <button
                            onClick={() => setRevertJob(job)}
                            className="text-amber-600 hover:text-amber-800 text-xs font-bold"
                          >
                            Review Revert
                          </button>
                        ) : null}
                        <button
                          onClick={() => setInvoiceJob(job)}
                          className="text-purple-600 hover:text-purple-800 text-xs font-medium"
                        >
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      <QuoteModal open={showQuote} onClose={() => setShowQuote(false)} />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Register New Job" wide>
        <form onSubmit={handleCreate} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') e.preventDefault(); }} className="space-y-5">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>
          )}

          {/* Section 1: Customer */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3 pb-1 border-b">
              1 · Customer
            </p>
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Search Customer *</label>
              <input
                value={custSearch}
                onChange={(e) => searchCustomers(e.target.value)}
                placeholder="Type name or phone…"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {custSearching && (
                <p className="absolute left-3 top-9 text-xs text-gray-400 mt-1">Searching…</p>
              )}
              {custResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {custResults.map((c) => (
                    <button
                      key={c.id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.phone_number}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* No match → offer inline create */}
            {custSearch.trim() && !custSearching && custResults.length === 0 && !form.customer_id && !showNewCust && (
              <button type="button" onClick={openNewCustomer}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">
                + No customer found — add “{custSearch.trim()}” as new
              </button>
            )}

            {/* Inline new-customer form */}
            {showNewCust && (
              <div className="mt-3 border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">New Customer</p>
                  <button type="button" onClick={() => setShowNewCust(false)}
                    className="text-blue-400 hover:text-blue-600 text-lg leading-none">&times;</button>
                </div>
                {custError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{custError}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Name *</label>
                    <input name="name" value={newCust.name} onChange={handleNewCustChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone *</label>
                    <input name="phone_number" value={newCust.phone_number} onChange={handleNewCustChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="07XXXXXXXX" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Email</label>
                    <input name="email" value={newCust.email} onChange={handleNewCustChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="optional" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Address</label>
                    <input name="address" value={newCust.address} onChange={handleNewCustChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="optional" />
                  </div>
                </div>
                <button type="button" onClick={createInlineCustomer} disabled={creatingCust}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
                  {creatingCust ? "Saving…" : "Save Customer & Select"}
                </button>
              </div>
            )}

            {form.customer_id && (
              <p className="text-xs text-green-600 font-medium mt-1.5">Customer selected</p>
            )}
          </div>

          {/* Section 2: Device & Fault */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3 pb-1 border-b">
              2 · Device & Fault
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Device Brand *</label>
                <BrandSelect
                  required
                  value={form.device_brand}
                  onChange={(v) => setForm((f) => ({ ...f, device_brand: v, device_model: "" }))}
                  placeholder="Samsung"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Device Model *</label>
                <ModelSelect
                  required
                  brand={form.device_brand}
                  value={form.device_model}
                  onChange={(v) => setForm((f) => ({ ...f, device_model: v }))}
                  placeholder="Galaxy A54"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">IMEI (optional)</label>
                <input name="device_imei" value={form.device_imei} onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="15-digit IMEI" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Fault Category *</label>
                <select name="fault_category" value={form.fault_category} onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FAULT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Fault Description</label>
                <textarea name="fault_description" value={form.fault_description} onChange={handleChange} rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe the issue in more detail…" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Physical Condition</label>
                <textarea name="physical_condition" value={form.physical_condition} onChange={handleChange} rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="e.g. Screen cracked, deep scratch on back glass…" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Condition Photos</label>
                <ConditionPhotoUploader photos={photos} setPhotos={setPhotos} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Est. Completion Date</label>
                <input name="estimated_completion_date" type="date" min={getTodayDateString()} value={form.estimated_completion_date} onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Estimated Cost (LKR)</label>
                <input name="estimated_cost" type="number" min="0" step="0.01" value={form.estimated_cost} onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional — rough quote" />
                <p className="text-[11px] text-gray-400 mt-1">Leave blank if not investigated / no estimate given.</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input id="investigated" name="investigated" type="checkbox" checked={form.investigated}
                  onChange={(e) => setForm((f) => ({ ...f, investigated: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="investigated" className="text-sm text-gray-600 dark:text-gray-300 select-none">
                  Device investigated by technician
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Technician & Notes */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3 pb-1 border-b">
              3 · Assignment & Notes
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Assign Technician</label>
                <select name="technician_id" value={form.technician_id} onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Unassigned —</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Internal Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="For staff only…" />
              </div>
            </div>
          </div>

          {/* Smart Parts */}
          <SmartPartsPanel brand={form.device_brand} model={form.device_model} />

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
              {saving ? "Registering…" : "Register Job"}
            </button>
          </div>
        </form>
      </Modal>

      <RevertApprovalModal
        open={!!revertJob}
        job={revertJob}
        onClose={() => setRevertJob(null)}
        onDone={() => fetchJobs(statusFilter)}
      />

      <AdminJobDetailModal
        open={!!detailJobId}
        jobId={detailJobId}
        onClose={() => setDetailJobId(null)}
        onDone={() => fetchJobs(statusFilter)}
      />

      {/* Invoice / Receipt with QR */}
      {invoiceJob && (
        <InvoiceReceipt job={invoiceJob} onClose={() => setInvoiceJob(null)} />
      )}
    </div>
  );
}
