import React, { useEffect, useState, Fragment } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import InlineLogRefurbishPart from "./InlineLogRefurbishPart";

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

function Modal({ open, onClose, title, children, maxWidth = "max-w-md" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
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

export default function TechSalvageDevices() {
  const { user } = useAuth();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [activeTab, setActiveTab] = useState("refurbish"); // "refurbish" | "parts"

  // View device + parts modal
  const [viewDevice, setViewDevice]     = useState(null);
  const [parts, setParts]               = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);

  // Add part modal
  const [addPartOpen, setAddPartOpen]   = useState(false);
  const [partChecks, setPartChecks]     = useState({});
  const [customPartName, setCustomPartName] = useState("");
  const [customPartCondition, setCustomPartCondition] = useState("good");
  const [partSaving, setPartSaving]     = useState(false);

  // Refurbish modal
  const [refurbishDevice, setRefurbishDevice] = useState(null);
  const [refurbishForm, setRefurbishForm] = useState({
    parts_used_notes: "",
    qc_mic_tested: false,
    qc_camera_tested: false,
    qc_touch_tested: false,
    qc_biometrics_tested: false,
    qc_wifi_tested: false,
    qc_charging_tested: false,
  });
  const [refurbishSaving, setRefurbishSaving] = useState(false);
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

  const handleRemoveRefurbishedPart = async (partId) => {
    if (!window.confirm("Remove this part from the device and return it to inventory?")) return;
    try {
      await api.delete(`/donors/${refurbishDevice.id}/refurbished-parts/${partId}`);
      fetchRefurbishedParts(refurbishDevice.id);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to remove part");
    }
  };

  const COMMON_PARTS = [
    "Display / Screen",
    "Battery",
    "Rear Camera",
    "Front Camera",
    "Charging Port",
    "Logic Board / Motherboard",
    "Speaker",
    "Housing / Back Glass"
  ];

  const fetchDonors = async () => {
    try {
      const { data } = await api.get("/donors/");
      setDonors(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, []);

  const myDonors = donors.filter((d) => 
    d.assigned_technician_id === user?.id && 
    (d.status === "available" || d.status === "stripped") && 
    d.refurbish_status !== "pending_approval" && 
    d.refurbish_status !== "approved" &&
    d.source === "unclaimed_job" &&
    (d.purpose || "parts") === activeTab
  );
  
  const unclaimedDonors = donors.filter((d) => 
    !d.assigned_technician_id && 
    d.status === "available" && 
    d.refurbish_status !== "pending_approval" && 
    d.refurbish_status !== "approved" &&
    d.source === "unclaimed_job" &&
    (d.purpose || "parts") === activeTab
  );

  const handleClaimDonor = async (donor) => {
    setClaimingId(donor.id);
    try {
      await api.patch(`/donors/${donor.id}/claim`);
      setSelectedDonor(null);
      await fetchDonors();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to claim salvage device");
    } finally {
      setClaimingId(null);
    }
  };

  const openViewDevice = async (device) => {
    if (device.purpose === 'refurbish') {
      setRefurbishDevice(device);
      setViewDevice(null);
      setRefurbishForm({
        parts_used_notes: "",
        qc_mic_tested: false,
        qc_camera_tested: false,
        qc_touch_tested: false,
        qc_biometrics_tested: false,
        qc_wifi_tested: false,
        qc_charging_tested: false,
      });
      fetchRefurbishedParts(device.id);
      return;
    }

    setViewDevice(device);
    setRefurbishDevice(null);
    setPartsLoading(true);
    setParts([]);
    setPartChecks({});
    setCustomPartName("");
    setCustomPartCondition("good");
    try {
      const res = await api.get(`/donors/${device.id}/parts`);
      setParts(res.data);
    } catch {
      /* ignore */
    } finally {
      setPartsLoading(false);
    }
  };

  const handleSubmitRefurbish = async (e) => {
    e.preventDefault();
    setRefurbishSaving(true);
    try {
      await api.post(`/donors/${refurbishDevice.id}/refurbish-submit`, refurbishForm);
      setRefurbishDevice(null);
      await fetchDonors();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit refurbish details.");
    } finally {
      setRefurbishSaving(false);
    }
  };

  const handleToggleCheck = (partName) => {
    setPartChecks(prev => {
      const next = { ...prev };
      if (next[partName]) {
        delete next[partName];
      } else {
        next[partName] = { condition: "good" };
      }
      return next;
    });
  };

  const handleCheckCondition = (partName, condition) => {
    setPartChecks(prev => ({
      ...prev,
      [partName]: { condition }
    }));
  };

  const handleBulkAddParts = async (e) => {
    e.preventDefault();
    if (!viewDevice) return;
    
    const selected = Object.keys(partChecks).filter(k => partChecks[k]);
    if (selected.length === 0 && !customPartName.trim()) {
      alert("Please select at least one part or enter a custom part name.");
      return;
    }

    setPartSaving(true);
    try {
      const promises = selected.map(partName => {
        return api.post(`/donors/${viewDevice.id}/parts`, {
          donor_device_id: viewDevice.id,
          part_name: partName,
          compatible_brands: [viewDevice.brand],
          compatible_models: [viewDevice.model],
          condition: partChecks[partName].condition || "good"
        });
      });

      if (customPartName.trim()) {
        promises.push(api.post(`/donors/${viewDevice.id}/parts`, {
          donor_device_id: viewDevice.id,
          part_name: customPartName.trim(),
          compatible_brands: [viewDevice.brand],
          compatible_models: [viewDevice.model],
          condition: customPartCondition
        }));
      }

      await Promise.all(promises);
      
      // Mark the device as assessed so it disappears from the technician's list
      await api.patch(`/donors/${viewDevice.id}/assess`);
      
      setAddPartOpen(false);
      setViewDevice(null); // Close the main modal completely
      setPartChecks({});
      setCustomPartName("");
      setCustomPartCondition("good");
      
      await fetchDonors(); // refresh the list to remove the stripped device
    } catch (err) {
      alert("Failed to save some parts. Please check your network and try again.");
    } finally {
      setPartSaving(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Salvage Devices</h2>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => { setActiveTab("refurbish"); setViewDevice(null); setRefurbishDevice(null); }}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "refurbish" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
          }`}
        >
          Refurbishment Devices
        </button>
        <button
          onClick={() => { setActiveTab("parts"); setViewDevice(null); setRefurbishDevice(null); }}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "parts" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200"
          }`}
        >
          Parts Extraction
        </button>
      </div>

      {/* Unclaimed Salvage Devices */}
      {!loading && unclaimedDonors.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-800 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Available Salvage Devices — tap to view &amp; claim
            </h3>
            <span className="text-xs text-green-600">{unclaimedDonors.length} unclaimed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {unclaimedDonors.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDonor(d)}
                className="text-left bg-white dark:bg-gray-800 border border-green-100 hover:border-green-300 hover:shadow-sm rounded-lg px-3 py-2.5 transition-all"
              >
                <p className="font-mono text-xs font-semibold text-green-600 truncate">{d.brand} {d.model}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate mt-0.5">Condition: {d.condition}</p>
                <p className="text-xs text-gray-400 capitalize truncate">{d.source?.replace(/_/g, " ")}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My Salvage Devices Queue */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">My Claimed Salvage Devices</h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : myDonors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
            <p className="font-medium text-gray-500 dark:text-gray-400">No salvage devices claimed yet</p>
            <p className="text-sm mt-1">Claim an available salvage device above to strip parts</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr>
                {["Device", "Condition", "Source", "Status", "Registered"].map((h, i) => (
                  <th key={i} className="text-left pb-2.5 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {myDonors.map((d) => {
                const isExpandedParts = viewDevice?.id === d.id && activeTab === "parts";
                const isExpandedRefurbish = refurbishDevice?.id === d.id && activeTab === "refurbish";
                const isExpanded = isExpandedParts || isExpandedRefurbish;

                return (
                  <Fragment key={d.id}>
                    <tr 
                      onClick={() => {
                        if (isExpanded) {
                          setViewDevice(null);
                          setRefurbishDevice(null);
                          setAddPartOpen(false);
                        } else {
                          openViewDevice(d);
                        }
                      }}
                      className={`${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-blue-50 dark:hover:bg-gray-700'} transition-colors cursor-pointer`}
                    >
                      <td className="py-2.5 font-semibold text-gray-800 dark:text-gray-100 pl-2">{d.brand} {d.model}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300 capitalize text-xs">{d.condition}</td>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 capitalize text-xs">{d.source?.replace(/_/g, " ")}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${STATUS_BADGE[d.status] || "bg-blue-100 text-blue-700"}`}>
                          {d.status === "stripped" ? "completed" : d.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs">
                        {d.added_date ? new Date(d.added_date).toLocaleDateString("en-LK") : "—"}
                      </td>
                    </tr>

                    {/* Inline Expanded Area */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="5" className="p-0 border-b border-gray-100 dark:border-gray-800">
                          <div className="bg-gray-50/50 dark:bg-gray-800/30 p-6 shadow-inner">
                            
                            {/* --- PARTS EXTRACTION VIEW --- */}
                            {isExpandedParts && viewDevice && (
                              <div className="space-y-4 max-w-2xl mx-auto">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Usable Parts ({parts.length})</h4>
                                    <button
                                      onClick={() => setAddPartOpen(true)}
                                      className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      + Mark Usable Parts
                                    </button>
                                  </div>

                                  {partsLoading ? (
                                    <p className="text-xs text-gray-400 text-center py-4 animate-pulse">Loading parts…</p>
                                  ) : parts.length === 0 ? (
                                    <div className="border-2 border-dashed border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg py-6 text-center">
                                      <p className="text-xs text-gray-400">No parts marked as usable yet</p>
                                      <button onClick={() => setAddPartOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 mt-1 font-medium">
                                        Mark usable parts →
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2 pr-2">
                                      {parts.map((p) => (
                                        <div key={p.id} className="flex items-start justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 text-xs">
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

                                {/* Inline add-part checklist form */}
                                {addPartOpen && (
                                  <form onSubmit={handleBulkAddParts} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mt-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Mark Usable Parts</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select the parts that are in working condition from this device. Compatibility will be automatically set to {viewDevice.brand} {viewDevice.model}.</p>
                                    
                                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                                      {COMMON_PARTS.map(partName => {
                                        const isChecked = !!partChecks[partName];
                                        const alreadyExtracted = parts.some(p => p.part_name === partName);
                                        
                                        if (alreadyExtracted) return null; // hide if already logged

                                        return (
                                          <div key={partName} className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
                                              <input 
                                                type="checkbox" 
                                                checked={isChecked} 
                                                onChange={() => handleToggleCheck(partName)}
                                                className="w-4 h-4 text-green-600 border-gray-300 dark:border-gray-600 rounded focus:ring-green-500"
                                              />
                                              {partName}
                                            </label>
                                            {isChecked && (
                                              <select 
                                                value={partChecks[partName].condition} 
                                                onChange={(e) => handleCheckCondition(partName, e.target.value)}
                                                className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                                              >
                                                <option value="good">Good</option>
                                                <option value="fair">Fair</option>
                                                <option value="poor">Poor</option>
                                              </select>
                                            )}
                                          </div>
                                        );
                                      })}
                                      
                                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Other Part (Not in list)</label>
                                        <div className="flex gap-2">
                                          <input 
                                            value={customPartName} 
                                            onChange={(e) => setCustomPartName(e.target.value)}
                                            className={`${inputCls} flex-1`} 
                                            placeholder="e.g. Volume Flex Cable" 
                                          />
                                          <select 
                                            value={customPartCondition} 
                                            onChange={(e) => setCustomPartCondition(e.target.value)} 
                                            className={selectCls}
                                            style={{ width: '100px' }}
                                          >
                                            <option value="good">Good</option>
                                            <option value="fair">Fair</option>
                                            <option value="poor">Poor</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                      <button type="button" onClick={() => setAddPartOpen(false)}
                                        className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                                        Cancel
                                      </button>
                                      <button type="submit" disabled={partSaving}
                                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 rounded-lg text-sm font-semibold">
                                        {partSaving ? "Saving…" : "Save Marked Parts"}
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            )}

                            {/* --- REFURBISHMENT VIEW --- */}
                            {isExpandedRefurbish && refurbishDevice && (
                              <div className="space-y-4 max-w-2xl mx-auto bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-4">
                                  <h4 className="font-semibold text-blue-800 dark:text-blue-300">
                                    Refurbishing {refurbishDevice.brand} {refurbishDevice.model}
                                  </h4>
                                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                                    Log the parts used and complete the QC checklist before submitting for approval.
                                  </p>
                                </div>
                                
                                <div className="mb-4">
                                  <InlineLogRefurbishPart 
                                    device={refurbishDevice} 
                                    onSuccess={() => fetchRefurbishedParts(refurbishDevice.id)} 
                                  />
                                  
                                  {refurbishedPartsLoading ? (
                                    <p className="text-xs text-gray-500 my-2">Loading logged parts...</p>
                                  ) : refurbishedParts.length > 0 ? (
                                    <div className="space-y-2 mt-4 mb-4">
                                      <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300">Logged Parts</h5>
                                      {refurbishedParts.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2.5 rounded-lg">
                                          <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.inventory_item_name}</p>
                                            <p className="text-xs text-gray-500">Qty: {p.quantity}</p>
                                          </div>
                                          <button 
                                            type="button"
                                            onClick={() => handleRemoveRefurbishedPart(p.id)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="Remove part"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <Field label="Additional Repair Notes">
                                  <textarea
                                    className={inputCls}
                                    rows="2"
                                    value={refurbishForm.parts_used_notes}
                                    onChange={e => setRefurbishForm({...refurbishForm, parts_used_notes: e.target.value})}
                                    placeholder="e.g. Cleaned internals"
                                  />
                                </Field>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                    Quality Control Checklist
                                  </label>
                                  <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    {['mic', 'camera', 'touch', 'biometrics', 'wifi', 'charging'].map(qc => (
                                      <label key={qc} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={refurbishForm[`qc_${qc}_tested`]}
                                          onChange={e => setRefurbishForm({...refurbishForm, [`qc_${qc}_tested`]: e.target.checked})}
                                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                        />
                                        <span className="capitalize">{qc} Tested</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                                  <button
                                    type="button"
                                    onClick={handleSubmitRefurbish}
                                    disabled={refurbishSaving}
                                    className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-400 transition-colors shadow-sm"
                                  >
                                    {refurbishSaving ? "Submitting..." : "Submit for Approval"}
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Unclaimed salvage device details + claim */}
      <Modal open={!!selectedDonor} onClose={() => setSelectedDonor(null)} title="Claim Salvage Device">
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
                <p className="font-medium text-gray-800 dark:text-gray-100">{selectedDonor.brand} {selectedDonor.model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Condition</p>
                <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{selectedDonor.condition}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Source</p>
                <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{selectedDonor.source?.replace(/_/g, " ")}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedDonor(null)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
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
    </div>
  );
}
