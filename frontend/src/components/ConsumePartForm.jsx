import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import ScanField from "./ScanField";

/**
 * Consume a part for a repair job by its human-readable Batch Code.
 *
 * Designed for shops WITHOUT a hardware scanner: the technician reads the
 * printed label (e.g. "SS-BAT-0003-B1") and either types it, picks it from the
 * filtered dropdown, or uses the optional phone-camera scanner in <ScanField>.
 *
 * Props:
 *   jobId      - the job the part is consumed on (required)
 *   onConsumed - callback(line) fired after a successful consume
 */
export default function ConsumePartForm({ jobId, onConsumed }) {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [code, setCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load every in-stock batch once, so we can offer a filtered dropdown and a
  // live cost/availability preview as the technician types.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: items } = await api.get("/inventory/");
        if (!active) return;
        const flat = [];
        for (const item of items) {
          for (const b of item.batches || []) {
            if (b.quantity_remaining > 0) {
              flat.push({ ...b, item_name: item.name, sku: item.sku, track_serial: item.track_serial });
            }
          }
        }
        setBatches(flat);
      } catch {
        if (active) setError("Could not load available batches.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Live match for the typed/scanned code (case-insensitive, trimmed).
  const selected = useMemo(() => {
    const c = code.trim().toLowerCase();
    const match = batches.find((b) => b.batch_code.toLowerCase() === c) || null;
    if (match && match.track_serial && quantity !== 1) setQuantity(1);
    return match;
  }, [code, batches, quantity]);

  // Filtered suggestions for the dropdown as the user types.
  const suggestions = useMemo(() => {
    const c = code.trim().toLowerCase();
    if (!c) return batches.slice(0, 8);
    return batches
      .filter(
        (b) =>
          b.batch_code.toLowerCase().includes(c) ||
          b.item_name.toLowerCase().includes(c)
      )
      .slice(0, 8);
  }, [code, batches]);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    const batchCode = code.trim();
    if (!batchCode) return setError("Enter or select a batch code.");
    if (!quantity || quantity < 1) return setError("Quantity must be at least 1.");

    const payload = {
      batch_code: batchCode,
      job_id: jobId,
      technician_id: user?.id ?? null,
      quantity: Number(quantity),
    };
    if (selected?.track_serial) {
      if (!serialNumber.trim()) return setError("Serial number is required for this part.");
      payload.serial_number = serialNumber.trim();
      payload.quantity = 1;
    }

    setSaving(true);
    try {
      const { data: line } = await api.post("/inventory/consume", payload);
      setCode("");
      setSerialNumber("");
      setQuantity(1);
      onConsumed?.(line);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to consume part.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Batch Code
        </label>

        {/* Type / search (datalist gives a native filtered dropdown) */}
        <input
          list="batch-code-options"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. SS-BAT-0003-B1"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <datalist id="batch-code-options">
          {suggestions.map((b) => (
            <option key={b.id} value={b.batch_code}>
              {b.item_name} · {b.quantity_remaining} left
            </option>
          ))}
        </datalist>

        {/* Optional scan-or-type fallback (USB scanner / phone camera) */}
        <div className="mt-2">
          <ScanField onCode={(c) => setCode(c)} placeholder="…or scan the label" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Quantity
        </label>
        <input
          type="number"
          min={1}
          value={quantity}
          disabled={selected?.track_serial}
          onChange={(e) => setQuantity(e.target.value)}
          className={`w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${selected?.track_serial ? 'bg-gray-100 dark:bg-gray-800 text-gray-500' : ''}`}
        />
        {selected?.track_serial && <span className="ml-3 text-xs text-purple-600 font-semibold">Quantity fixed to 1 for serialized parts.</span>}
      </div>

      {selected?.track_serial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Serial Number *
          </label>
          <input
            type="text"
            required
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="Scan or type serial number..."
          />
        </div>
      )}

      {/* Live preview of the resolved batch */}
      {selected && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 text-sm">
          <p className="font-semibold text-gray-800 dark:text-gray-100">{selected.item_name}</p>
          <p className="text-gray-500 dark:text-gray-400">
            {selected.sku} · {selected.quantity_remaining} in stock · cost LKR{" "}
            {Number(selected.unit_cost).toFixed(2)} / unit
          </p>
          {quantity > selected.quantity_remaining && (
            <p className="text-red-600 mt-1">
              Only {selected.quantity_remaining} available in this batch.
            </p>
          )}
        </div>
      )}
      {code.trim() && !selected && (
        <p className="text-xs text-amber-600">
          No in-stock batch matches “{code.trim()}”. Check the printed label.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Consuming…" : "Consume Part"}
      </button>
    </form>
  );
}
