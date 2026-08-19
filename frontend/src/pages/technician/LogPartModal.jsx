import { useState, useEffect } from "react";
import api from "../../services/api";
import ScanField from "../../components/ScanField";

export default function LogPartModal({ job, onClose, onSuccess }) {
  const [invItems, setInvItems] = useState([]);
  const [partItemId, setPartItemId] = useState("");
  const [partBatch, setPartBatch] = useState(null);
  const [partQty, setPartQty] = useState(1);
  const [partError, setPartError] = useState("");
  const [partInfo, setPartInfo] = useState("");
  const [savingPart, setSavingPart] = useState(false);

  useEffect(() => {
    const fetchInv = async () => {
      try {
        const { data } = await api.get("/inventory/", { params: {} });
        setInvItems(data.filter((i) => i.quantity > 0));
      } catch { setInvItems([]); }
    };
    fetchInv();
  }, []);

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
      await api.post(`/jobs/${job.id}/parts`, {
        part_source: "inventory",
        inventory_item_id: partItemId || null,
        batch_id: partBatch?.id || null,
        quantity: parseInt(partQty, 10),
      });
      onSuccess();
    } catch (err) {
      setPartError(err.response?.data?.detail || "Failed to log part");
    } finally {
      setSavingPart(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Log Part — {job?.job_id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">
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
              <select required value={partItemId} onChange={(e) => { setPartItemId(e.target.value); setPartBatch(null); setPartInfo(""); }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select inventory item —</option>
                {invItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.sku ? `${i.sku} · ` : ""}{i.name} (Stock: {i.quantity})</option>
                ))}
              </select>
              {partBatch && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Will deduct from batch <span className="font-mono">{partBatch.code}</span></p>
              )}
              <p className="text-xs text-gray-400 mt-1">Cost is recorded automatically from the batch (FIFO).</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
              <input type="number" min="1" required value={partQty} onChange={(e) => setPartQty(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                Cancel
              </button>
              <button type="submit" disabled={savingPart}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {savingPart ? "Saving..." : "Log Part"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
