import { useState } from "react";
import api from "../../services/api";
import ScanField from "../../components/ScanField";

export default function InlineLogRefurbishPart({ device, onSuccess }) {
  const [partItemId, setPartItemId] = useState("");
  const [partBatch, setPartBatch] = useState(null);
  const [partQty, setPartQty] = useState(1);
  const [partError, setPartError] = useState("");
  const [partInfo, setPartInfo] = useState("");
  const [savingPart, setSavingPart] = useState(false);

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
        setPartInfo(`Matched ${data.item.name} · ${data.item.quantity} in stock`);
      }
    } catch (err) {
      setPartItemId("");
      setPartBatch(null);
      const detail = err.response?.data?.detail;
      setPartError(typeof detail === "string" ? detail : "Code not recognised");
    }
  };

  const handleLogPart = async (e) => {
    e.preventDefault();
    if (!partItemId || !partBatch) {
      setPartError("Please scan or select a part with an active batch first.");
      return;
    }
    setPartError("");
    setSavingPart(true);
    try {
      await api.post(`/donors/${device.id}/refurbished-parts`, {
        inventory_batch_id: partBatch.id,
        quantity: parseInt(partQty, 10),
      });
      // reset form
      setPartItemId(""); setPartBatch(null); setPartQty(1); setPartInfo("");
      if (onSuccess) onSuccess();
    } catch (err) {
      const data = err.response?.data;
      if (data?.detail && Array.isArray(data.detail)) {
        setPartError("Validation Error: " + data.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(", "));
      } else if (data?.detail) {
        setPartError(data.detail);
      } else {
        setPartError(err.message || "Failed to log part");
      }
    } finally {
      setSavingPart(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 shadow-sm">
      <form onSubmit={handleLogPart} className="space-y-3">
        {partError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{partError}</div>
        )}
        {partInfo && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg">{partInfo}</div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Scan or search inventory part</label>
            <ScanField onCode={handleScan} placeholder="Scan QR / SKU / batch code" searchEndpoint="/inventory/search_codes" />
          </div>
          <div className="w-full sm:w-24">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
            <input type="number" min="1" required value={partQty} onChange={(e) => setPartQty(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-[9px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
          </div>
          <div className="w-full sm:w-auto">
            <button type="submit" disabled={savingPart || !partItemId}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-[9px] px-5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              {savingPart ? "Saving…" : "Add Part"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
