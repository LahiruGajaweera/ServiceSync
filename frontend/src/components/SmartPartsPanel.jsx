import { useState } from "react";
import api from "../services/api";

export default function SmartPartsPanel({ brand, model }) {
  const [parts, setParts] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchParts = async () => {
    if (!brand?.trim() || !model?.trim()) return;
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

  const total = parts ? parts.inventory_parts.length + parts.donor_parts.length : 0;

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Smart Parts Suggestion</p>
        <button
          type="button"
          onClick={fetchParts}
          disabled={!brand?.trim() || !model?.trim() || loading}
          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1 rounded-lg font-medium transition-colors"
        >
          {loading ? "Checking…" : "Find Compatible Parts"}
        </button>
      </div>

      {!brand?.trim() || !model?.trim() ? (
        <p className="text-xs text-blue-600">Fill in Device Brand and Model above to check compatible stock.</p>
      ) : parts === null ? (
        <p className="text-xs text-blue-600">Click "Find Compatible Parts" to check inventory and donor stock.</p>
      ) : total === 0 ? (
        <p className="text-xs text-blue-700 font-medium">No compatible parts found for {brand} {model}.</p>
      ) : (
        <div className="space-y-3">
          {parts.inventory_parts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1.5">
                Factory / Inventory Parts ({parts.inventory_parts.length})
              </p>
              <div className="space-y-1.5">
                {parts.inventory_parts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs shadow-sm">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>Qty: <strong className="text-gray-700">{p.quantity}</strong></span>
                      <span>LKR {Number(p.unit_price).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {parts.donor_parts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1.5">
                Donor Parts ({parts.donor_parts.length})
              </p>
              <div className="space-y-1.5">
                {parts.donor_parts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs shadow-sm">
                    <span className="font-medium text-gray-800">{p.part_name}</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      p.condition === "good" ? "bg-green-100 text-green-700" :
                      p.condition === "fair" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>{p.condition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
