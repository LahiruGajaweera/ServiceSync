import React, { useEffect, useState, Fragment } from "react";
import api from "../../services/api";
import BrandSelect from "../../components/BrandSelect";
import ModelSelect from "../../components/ModelSelect";

const CONDITION_BADGE = {
  good: "bg-green-100 text-green-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-red-100 text-red-700",
};

const SOURCE_LABEL = {
  unclaimed_job: "Unclaimed Job",
  purchased:     "Purchased",
  donated:       "Donated",
  other:         "Other",
};

const STATUS_BADGE = {
  available: "bg-blue-100 text-blue-700",
  stripped:  "bg-teal-100 text-teal-700", // visually 'Completed'
  disposed:  "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
};

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const selectCls = inputCls;

export default function DonorDeviceConsole() {
  const [devices, setDevices]           = useState([]);
  const [technicians, setTechnicians]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [activeTab, setActiveTab]       = useState("devices"); // "devices" | "reviews" | "refurbish"

  const [pendingParts, setPendingParts] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Add device modal
  const [addOpen, setAddOpen]           = useState(false);
  const [addForm, setAddForm]           = useState({ brand: "", model: "", imei: "", condition: "good", source: "purchased", purchase_price: "", purpose: "parts", source_job_id: "", source_description: "", assigned_technician_id: "" });
  const [addSaving, setAddSaving]       = useState(false);

  // View device + parts modal
  const [viewDevice, setViewDevice]     = useState(null);
  const [parts, setParts]               = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);

  // Review device pending parts modal
  const [reviewGroup, setReviewGroup]   = useState(null);
  const [partPrices, setPartPrices]     = useState({});

  // Add part modal
  const [addPartOpen, setAddPartOpen]   = useState(false);
  const [partForm, setPartForm]         = useState({ part_name: "", compatible_brands: "", compatible_models: "", condition: "good" });
  const [partSaving, setPartSaving]     = useState(false);

  // Refurbish Approvals
  const refurbishPending = devices.filter(d => d.refurbish_status === "pending_approval");
  const [refurbishApproveDevice, setRefurbishApproveDevice] = useState(null);
  const [refurbishApproveForm, setRefurbishApproveForm] = useState({ selling_price: "" });
  const [refurbishApproving, setRefurbishApproving] = useState(false);
  const [refurbishedParts, setRefurbishedParts] = useState([]);
  const [refurbishedPartsLoading, setRefurbishedPartsLoading] = useState(false);

  const fetchRefurbishedParts = async (deviceId) => {
    setRefurbishedPartsLoading(true);
    try {
      const res = await api.get(`/donors/${deviceId}/refurbished-parts`);
      setRefurbishedParts(res.data);
    } catch {
      // ignore
    } finally {
      setRefurbishedPartsLoading(false);
    }
  };

  const handleApproveRefurbish = async (e) => {
    e.preventDefault();
    setRefurbishApproving(true);
    try {
      await api.post(`/donors/${refurbishApproveDevice.id}/refurbish-approve`, {
        selling_price: parseFloat(refurbishApproveForm.selling_price)
      });
      setRefurbishApproveDevice(null);
      await fetchDevices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve refurbish");
    } finally {
      setRefurbishApproving(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await api.get("/donors/");
      setDevices(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const res = await api.get("/users/");
      setTechnicians(res.data.filter((u) => u.role === "technician"));
    } catch {
      /* ignore */
    }
  };

  const fetchPendingParts = async () => {
    setPendingLoading(true);
    try {
      const res = await api.get("/donors/parts/pending");
      setPendingParts(res.data);
    } catch {
      /* ignore */
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => { 
    fetchDevices(); 
    fetchTechnicians();
    fetchPendingParts();
  }, []);

  const handleApproveAll = async (group) => {
    // Open window immediately to bypass popup blockers
    const printWin = window.open('', '_blank');
    
    try {
      const responses = await Promise.all(group.map(p => 
        api.patch(`/donors/parts/${p.id}/approve`, { estimated_value: parseFloat(partPrices[p.id]) || 0 })
      ));
      
      const approvedParts = responses.map(r => r.data);
      
      // Remove from pending list
      setPendingParts(prev => prev.filter(p => !group.find(gp => gp.id === p.id)));
      setReviewGroup(null);
      setPartPrices({});
      
      const devId = group[0].donor_device_id;
      const dev = devices.find(d => d.id === devId) || { brand: "Unknown", model: "Device", id: devId, imei: "N/A" };

      // Print label logic for EACH PART
      const labelsHtml = approvedParts.map(p => `
        <div class="label-page">
          <div class="title">${dev.brand} ${dev.model}</div>
          <div class="subtitle">${p.part_name}</div>
          <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(p.sku)}" alt="QR Code" />
          <div class="sku">${p.sku}</div>
          <div class="price">Rs. ${p.estimated_value.toFixed(2)}</div>
        </div>
      `).join('');

      const labelContent = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; font-family: monospace; text-align: center; }
              .label-page { padding: 10px; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; }
              .title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
              .subtitle { font-size: 12px; margin-bottom: 5px; }
              .sku { font-size: 12px; margin-top: 5px; font-weight: bold; }
              .price { font-size: 14px; font-weight: bold; margin-top: 2px; }
              .qr-code { margin: 5px auto; width: 80px; height: 80px; display: block; }
            </style>
          </head>
          <body>
            ${labelsHtml}
          </body>
        </html>
      `;
      printWin.document.open();
      printWin.document.write(labelContent);
      printWin.document.close();
      
      // Wait for image to load, then print from parent context
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 500);
      
    } catch (err) {
      if (printWin) printWin.close();
      alert("Failed to approve parts. Please check your network.");
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      const payload = {
        brand:         addForm.brand.trim(),
        model:         addForm.model.trim(),
        imei:          addForm.imei.trim() || null,
        condition:     addForm.condition,
        source:        addForm.source,
        purpose:       addForm.purpose,
        purchase_price: addForm.source === "purchased" && addForm.purchase_price ? parseFloat(addForm.purchase_price) : null,
        source_job_id: addForm.source_job_id.trim() || null,
        source_description: addForm.source === "other" ? (addForm.source_description?.trim() || null) : null,
        assigned_technician_id: addForm.assigned_technician_id || null,
      };
      const res = await api.post("/donors/", payload);
      setAddOpen(false);
      setAddForm({ brand: "", model: "", imei: "", condition: "good", source: "purchased", purchase_price: "", purpose: "parts", source_job_id: "", source_description: "", assigned_technician_id: "" });
      setDevices(prev => [res.data, ...prev]);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to register device");
    } finally {
      setAddSaving(false);
    }
  };

  const openViewDevice = async (device) => {
    setViewDevice(device);
    setPartsLoading(true);
    setParts([]);
    try {
      const res = await api.get(`/donors/${device.id}/parts`);
      setParts(res.data);
    } catch {
      /* ignore */
    } finally {
      setPartsLoading(false);
    }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    if (!viewDevice) return;
    setPartSaving(true);
    try {
      const payload = {
        donor_device_id:    viewDevice.id,
        part_name:          partForm.part_name.trim(),
        compatible_brands:  partForm.compatible_brands.split(",").map((s) => s.trim()).filter(Boolean),
        compatible_models:  partForm.compatible_models.split(",").map((s) => s.trim()).filter(Boolean),
        condition:          partForm.condition,
      };
      await api.post(`/donors/${viewDevice.id}/parts`, payload);
      setAddPartOpen(false);
      setPartForm({ part_name: "", compatible_brands: "", compatible_models: "", condition: "good" });
      // Refresh parts list
      const res = await api.get(`/donors/${viewDevice.id}/parts`);
      setParts(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to add part");
    } finally {
      setPartSaving(false);
    }
  };

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.brand.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      (d.imei ?? "").toLowerCase().includes(q) ||
      d.source.toLowerCase().includes(q)
    );
  });

  const pendingGroups = Object.values(
    pendingParts.reduce((acc, part) => {
      const devId = part.donor_device_id;
      if (!acc[devId]) acc[devId] = [];
      acc[devId].push(part);
      return acc;
    }, {})
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Donor Device Console</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage unclaimed, purchased, and donated devices for parts harvest</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Register Device
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("devices")}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "devices" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
          }`}
        >
          Donor Devices
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "reviews" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
          }`}
        >
          Pending Reviews
          {pendingParts.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingParts.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("refurbish")}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "refurbish" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
          }`}
        >
          Refurbish Approvals
          {refurbishPending.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{refurbishPending.length}</span>
          )}
        </button>
      </div>

      {activeTab === "devices" ? (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by brand, model, IMEI…"
              className="w-full max-w-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Device Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading devices…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl m-4">
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No donor devices registered</p>
            <p className="text-gray-400 text-xs mt-1">Register unclaimed or donated devices to extract salvageable parts</p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Register first device →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Brand / Model", "IMEI", "Source", "Condition", "Status", "Technician", "Registered"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((d) => {
                  const isExpanded = viewDevice?.id === d.id;

                  return (
                  <Fragment key={d.id}>
                  <tr 
                    className={`${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-blue-50 dark:hover:bg-gray-700'} transition-colors cursor-pointer`}
                    onClick={(e) => {
                      if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'OPTION') {
                          if (isExpanded) {
                            setViewDevice(null);
                          } else {
                            openViewDevice(d);
                          }
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {d.brand} {d.model}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{d.imei || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {SOURCE_LABEL[d.source] ?? d.source}
                        {d.source === "other" && d.source_description && <span className="block text-[10px] text-gray-400 truncate max-w-[120px]" title={d.source_description}>{d.source_description}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${CONDITION_BADGE[d.condition] ?? ""}`}>
                        {d.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[d.status] ?? ""}`}>
                        {d.status === "stripped" ? "completed" : d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {d.assigned_technician_id 
                          ? technicians.find(t => t.id === d.assigned_technician_id)?.name || "—" 
                          : "-- Unassigned --"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(d.added_date).toLocaleDateString()}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan="7" className="p-0 border-b border-gray-100 dark:border-gray-800">
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 p-6 shadow-inner">
                          <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Extracted Parts ({parts.length})</h4>
                            </div>

                            {partsLoading ? (
                              <p className="text-xs text-gray-400 text-center py-4 animate-pulse">Loading parts…</p>
                            ) : parts.length === 0 ? (
                              <div className="border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg py-6 text-center">
                                <p className="text-xs text-gray-400">No parts extracted yet</p>
                              </div>
                            ) : (
                              <div className="space-y-2 pr-2">
                                {parts.map((p) => (
                                  <div key={p.id} className="flex items-start justify-between border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-3 text-xs shadow-sm">
                                    <div>
                                      <p className="font-semibold text-gray-800 dark:text-gray-100">{p.part_name}</p>
                                      {p.compatible_brands?.length > 0 && (
                                        <p className="text-gray-400 mt-0.5">Brands: {p.compatible_brands.join(", ")}</p>
                                      )}
                                      {p.compatible_models?.length > 0 && (
                                        <p className="text-gray-400">Models: {p.compatible_models.join(", ")}</p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 ml-4">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${CONDITION_BADGE[p.condition] ?? ""}`}>
                                        {p.condition}
                                      </span>
                                      {p.approval_status === "pending" ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                                          Awaiting Approval
                                        </span>
                                      ) : (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
                                          {p.is_available ? "Available" : "Used"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : activeTab === "reviews" ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Pending Part Reviews</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Parts submitted by technicians waiting for admin approval and labeling.</p>
          </div>
          {pendingLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading pending parts…</div>
          ) : pendingGroups.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No pending parts</p>
              <p className="text-gray-400 text-xs mt-1">All extracted parts have been approved.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">IMEI</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Pending Parts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {pendingGroups.map(group => {
                  const devId = group[0].donor_device_id;
                  const dev = devices.find(d => d.id === devId) || { brand: "Unknown", model: "Device", imei: "" };
                  
                  return (
                  <tr key={devId} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => {
                      const initialPrices = {};
                      group.forEach(p => initialPrices[p.id] = "");
                      setPartPrices(initialPrices);
                      setReviewGroup(group);
                  }}>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{dev.brand} {dev.model}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {dev.imei || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        {group.length} parts
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "refurbish" ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Refurbish Approvals</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Refurbished devices pending selling price setup and inventory addition.</p>
          </div>
          {refurbishPending.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No pending approvals</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">IMEI</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Technician</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Date Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {refurbishPending.map(dev => (
                  <tr key={dev.id} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => {
                    setRefurbishApproveForm({ selling_price: "" });
                    setRefurbishApproveDevice(dev);
                    fetchRefurbishedParts(dev.id);
                  }}>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{dev.brand} {dev.model}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{dev.imei || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {technicians.find(t => t.id === dev.assigned_technician_id)?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(dev.added_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {/* ── Add Device Modal ─────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Register Donor Device">
        <form onSubmit={handleAddDevice} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand *">
              <BrandSelect
                required
                value={addForm.brand}
                onChange={(v) => setAddForm({ ...addForm, brand: v, model: "" })}
                placeholder="Apple"
              />
            </Field>
            <Field label="Model *">
              <ModelSelect
                required
                brand={addForm.brand}
                value={addForm.model}
                onChange={(v) => setAddForm({ ...addForm, model: v })}
                placeholder="iPhone 13"
              />
            </Field>
          </div>
          <Field label="IMEI (optional)">
            <input value={addForm.imei} onChange={(e) => setAddForm({ ...addForm, imei: e.target.value })}
              className={inputCls} placeholder="15-digit IMEI" maxLength={20} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Condition *">
              <select value={addForm.condition} onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })} className={selectCls}>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </Field>
            <Field label="Source *">
              <select value={addForm.source} onChange={(e) => setAddForm({ ...addForm, source: e.target.value })} className={selectCls}>
                <option value="purchased">Purchased</option>
                <option value="donated">Donated</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          {addForm.source === "other" && (
            <Field label="Source Description">
              <input value={addForm.source_description || ""} onChange={(e) => setAddForm({ ...addForm, source_description: e.target.value })}
                className={inputCls} placeholder="e.g. Scrapped from old inventory" />
            </Field>
          )}
          {addForm.source === "purchased" && (
            <Field label="Purchase Price">
              <input type="number" min="0" step="0.01" value={addForm.purchase_price || ""} onChange={(e) => setAddForm({ ...addForm, purchase_price: e.target.value })}
                className={inputCls} placeholder="e.g. 5000.00" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purpose *">
              <select value={addForm.purpose} onChange={(e) => setAddForm({ ...addForm, purpose: e.target.value })} className={selectCls}>
                <option value="parts">For Parts</option>
                <option value="refurbish">To Refurbish</option>
              </select>
            </Field>
            <Field label="Assign Technician (optional)">
              <select value={addForm.assigned_technician_id} onChange={(e) => setAddForm({ ...addForm, assigned_technician_id: e.target.value })} className={selectCls}>
                <option value="">-- Unassigned --</option>
                {technicians.filter(t => t.is_active || t.id === addForm.assigned_technician_id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.specializations ? `(${t.specializations})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddOpen(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={addSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {addSaving ? "Registering…" : "Register Device"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Device + Parts Modal ─────────────────────── */}


      {/* ── Review Device Parts Modal ─────────────────────── */}
      <Modal open={!!reviewGroup} onClose={() => setReviewGroup(null)} title="Review Extraction">
        {reviewGroup && (() => {
          const devId = reviewGroup[0].donor_device_id;
          const dev = devices.find(d => d.id === devId) || { brand: "Unknown", model: "Device", imei: "" };
          
          return (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800">{dev.brand} {dev.model}</h4>
              <p className="text-xs text-amber-700 mt-1">IMEI: <span className="font-mono">{dev.imei || "—"}</span></p>
              <p className="text-xs text-amber-600 mt-2">
                A technician has marked the following parts as usable. Enter the estimated selling price for each part. Approving will print a QR label for each part.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Pending Parts ({reviewGroup.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {reviewGroup.map(p => (
                  <div key={p.id} className="flex items-center gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-3 text-xs bg-white dark:bg-gray-800">
                    <div className="flex-1">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{p.part_name}</span>
                      <div className="mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${CONDITION_BADGE[p.condition] ?? ""}`}>
                          {p.condition}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium text-[10px]">Rs.</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        value={partPrices[p.id] !== undefined ? partPrices[p.id] : ""}
                        onChange={(e) => setPartPrices(prev => ({...prev, [p.id]: e.target.value}))}
                        className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => handleApproveAll(reviewGroup)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Approve All &amp; Print Device Label
              </button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* ── Refurbish Approve Modal ───────────────────────── */}
      <Modal open={!!refurbishApproveDevice} onClose={() => setRefurbishApproveDevice(null)} title="Approve Refurbished Device">
        {refurbishApproveDevice && (() => {
          const baseCost = Number(refurbishApproveDevice.purchase_price || 0);
          const partsCost = refurbishedParts.reduce((sum, p) => sum + (Number(p.unit_cost) * Number(p.quantity)), 0);
          const totalCost = baseCost + partsCost;

          return (
          <form onSubmit={handleApproveRefurbish} className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300">
                {refurbishApproveDevice.brand} {refurbishApproveDevice.model}
              </h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Technician Notes: {refurbishApproveDevice.parts_used_notes || "None"}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">QC Checklist Results</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {['mic', 'camera', 'touch', 'biometrics', 'wifi', 'charging'].map(qc => {
                  const passed = refurbishApproveDevice[`qc_${qc}_tested`];
                  return (
                    <div key={qc} className="flex items-center space-x-1">
                      {passed ? (
                        <span className="text-green-500 font-bold">✓</span>
                      ) : (
                        <span className="text-red-500 font-bold">✗</span>
                      )}
                      <span className="capitalize">{qc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
              <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">Cost Breakdown</h5>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Device Purchase Price:</span>
                <span className="font-medium">Rs. {baseCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Parts Cost ({refurbishedParts.length} items):</span>
                <span className="font-medium">Rs. {partsCost.toFixed(2)}</span>
              </div>
              {refurbishedPartsLoading && <p className="text-xs text-gray-400">Loading parts...</p>}
              {refurbishedParts.length > 0 && (
                <div className="pl-4 py-2 space-y-1">
                  {refurbishedParts.map(p => (
                    <div key={p.id} className="flex justify-between text-xs text-gray-400">
                      <span>- {p.inventory_item_name} (x{p.quantity})</span>
                      <span>Rs. {(Number(p.unit_cost) * Number(p.quantity)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-800 dark:text-gray-100 border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                <span>Total Refurbishment Cost:</span>
                <span>Rs. {totalCost.toFixed(2)}</span>
              </div>
            </div>

            <Field label="Final Selling Price (Rs.)">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className={inputCls}
                value={refurbishApproveForm.selling_price}
                onChange={e => setRefurbishApproveForm({...refurbishApproveForm, selling_price: e.target.value})}
                placeholder="0.00"
              />
            </Field>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                type="submit"
                disabled={refurbishApproving}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-400"
              >
                {refurbishApproving ? "Approving..." : "Approve & Add to Inventory"}
              </button>
            </div>
          </form>
          );
        })()}
      </Modal>

    </div>
  );
}
