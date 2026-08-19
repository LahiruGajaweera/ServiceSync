import { useEffect, useState } from "react";
import QRCode from "qrcode";
import api from "../../services/api";
import BrandSelect from "../../components/BrandSelect";
import ModelSelect from "../../components/ModelSelect";
import SpecSelect from "../../components/SpecSelect";
import MultiSelect from "../../components/MultiSelect";
import SupplierSelect from "../../components/SupplierSelect";
import AlertCard from "../../components/AlertCard";
import AutoSlidingAlerts from "../../components/AutoSlidingAlerts";
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "", brand: "", model: "", category: "", spec: "", part_type: "factory_new",
  min_stock_threshold: "2", supplier: "", track_serial: false,
  compatible_brands: [], compatible_models: [],
  quantity: "", unit_cost: "", margin: "30", unit_price: "",
};

const EMPTY_RECEIVE = { supplier: "", unit_cost: "", margin: "30", new_selling_price: "", quantity: "", purchased_at: new Date().toISOString().split("T")[0], update_selling_price: false };

/** Open a printable QR label for a batch/part. The QR encodes the scannable code. */
async function printLabel({ code, sku, name, supplier, qty, unitCost }) {
  let qr = "";
  try {
    qr = await QRCode.toDataURL(code, { width: 220, margin: 1 });
  } catch {
    qr = "";
  }
  const win = window.open("", "PrintLabel", "width=380,height=460");
  if (!win) {
    alert("Please allow pop-ups to print the label.");
    return;
  }
  win.document.write(`<!doctype html><html><head><title>Label ${code}</title>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111827; margin: 0; padding: 16px; }
      .label { width: 280px; margin: 0 auto; border: 1px solid #111827; border-radius: 10px; padding: 14px; text-align: center; }
      .name { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
      .sku { font-size: 11px; color: #6b7280; letter-spacing: .5px; }
      .qr { margin: 10px auto 6px; }
      .code { font-size: 15px; font-weight: 800; letter-spacing: 1px; }
      .meta { font-size: 11px; color: #374151; margin-top: 6px; line-height: 1.5; }
    </style></head><body>
    <div class="label">
      <div class="name">${name || ""}</div>
      <div class="sku">${sku || ""}</div>
      ${qr ? `<img class="qr" src="${qr}" width="160" height="160" alt="QR" />` : ""}
      <div class="code">${code}</div>
      <div class="meta">
        ${supplier ? `Supplier: ${supplier}<br/>` : ""}
        ${qty != null ? `Qty: ${qty}` : ""}${unitCost != null ? ` &nbsp;·&nbsp; LKR ${Number(unitCost).toLocaleString()}` : ""}
      </div>
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

/** Build a consistent, traceable part name from its attributes:
 *  "{Brand} {Model} {Category} {Spec}" using the dedicated brand & model selection. */
function buildPartName(form) {
  return [form.brand, form.model, form.category, form.spec]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
}

function CatalogFormFields({ form, handleChange, setForm, showInitialStock, categories = [] }) {
  const generatedName = buildPartName(form);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Part Name (auto-generated)</label>
        <div className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm min-h-[38px] flex items-center">
          {generatedName
            ? <span className="font-semibold text-gray-800 dark:text-gray-100">{generatedName}</span>
            : <span className="text-gray-400">Select brand, model, category &amp; spec below…</span>}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Built automatically from the selected brand + model + category + spec, for consistent, traceable names.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Brand *</label>
        <BrandSelect
          value={form.brand}
          onChange={(v) => setForm((f) => ({ ...f, brand: v, model: "" }))}
          placeholder="Select brand"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Model *</label>
        <ModelSelect
          brand={form.brand}
          value={form.model}
          onChange={(v) => setForm((f) => ({ ...f, model: v }))}
          placeholder="Select model"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Category *</label>
        <input name="category" required value={form.category} onChange={handleChange} list="existing-categories"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Display" />
        <datalist id="existing-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Spec / Identifier</label>
        <SpecSelect value={form.spec} onChange={(v) => setForm((f) => ({ ...f, spec: v }))} placeholder="e.g. OLED, OEM, 5000MAH" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Type *</label>
        <select name="part_type" value={form.part_type} onChange={handleChange}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="factory_new">Factory New</option>
          <option value="salvaged">Salvaged</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Min Stock Threshold</label>
        <input name="min_stock_threshold" type="number" min="0" value={form.min_stock_threshold} onChange={handleChange}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <input name="track_serial" type="checkbox" checked={form.track_serial} onChange={handleChange}
            className="rounded border-gray-300 dark:border-gray-600" />
          Track each unit (serial)
        </label>
      </div>
      <div className="col-span-2 mt-1 border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Compatibility</p>
        <p className="text-[11px] text-gray-400">Separate from the name — the full set of devices this part fits (used for smart-reuse suggestions). Pick from the registry to avoid typos; the selected brand &amp; model above are added automatically.</p>
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Compatible Brands</label>
        <MultiSelect
          value={form.compatible_brands}
          onChange={(arr) => setForm((f) => ({ ...f, compatible_brands: arr }))}
          fetchUrl="/brands/"
          allowAdd
          addNoun="brand"
          placeholder="Search brands…"
          onAddNew={async (name) => { const { data } = await api.post("/brands/", { name }); return data.name; }}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Compatible Models</label>
        <MultiSelect
          value={form.compatible_models}
          onChange={(arr) => setForm((f) => ({ ...f, compatible_models: arr }))}
          fetchUrl="/models/"
          fetchParams={{ brands: form.compatible_brands.filter(Boolean).join(",") }}
          allowAdd
          addNoun="model"
          disabled={form.compatible_brands.length === 0}
          placeholder={form.compatible_brands.length ? "Search models…" : "Select a compatible brand first…"}
          onAddNew={async (name) => { const { data } = await api.post("/models/", { brand: form.compatible_brands[0] || form.brand || "", name }); return data.name; }}
        />
      </div>

      {showInitialStock && (
        <>
          <div className="col-span-2 mt-1 border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Initial Stock & Pricing (optional)</p>
            <p className="text-xs text-gray-400">Creates the first purchase batch and sets the base selling price.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity</label>
            <input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Unit Cost (LKR)</label>
            <input name="unit_cost" type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => {
              const cost = parseFloat(e.target.value) || 0;
              const margin = parseFloat(form.margin) || 0;
              const price = (cost * (1 + margin / 100)).toFixed(2);
              setForm((f) => ({ ...f, unit_cost: e.target.value, unit_price: price }));
            }} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Margin %</label>
            <select name="margin" value={form.margin} onChange={(e) => {
              const margin = parseFloat(e.target.value) || 0;
              const cost = parseFloat(form.unit_cost) || 0;
              const price = (cost * (1 + margin / 100)).toFixed(2);
              setForm((f) => ({ ...f, margin: e.target.value, unit_price: price }));
            }} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="10">10%</option>
              <option value="20">20%</option>
              <option value="30">30%</option>
              <option value="50">50%</option>
              <option value="100">100%</option>
              <option value="0">Custom (0%)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Selling Price (LKR)</label>
            <input name="unit_price" type="number" step="0.01" min="0" value={form.unit_price} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Supplier</label>
            <SupplierSelect
              value={form.supplier}
              onChange={(v) => setForm((f) => ({ ...f, supplier: v }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function InventoryManager() {
  const [items, setItems]           = useState([]);
  const [lowStock, setLowStock]     = useState([]);
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort();
  const [loading, setLoading]       = useState(true);
  const [inventoryForecast, setInventoryForecast] = useState([]);
  const [search, setSearch]         = useState("");
  const [showAddModal, setShowAdd]  = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState("");
  const [labelPrompt, setLabelPrompt] = useState(null);
  const [saving, setSaving]         = useState(false);

  // Receive stock
  const [receiveItem, setReceiveItem] = useState(null);
  const [receiveForm, setReceiveForm] = useState(EMPTY_RECEIVE);

  // Item Details / Batches viewer
  const [detailsItem, setDetailsItem] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Adjust stock
  const [showStockModal, setShowStock] = useState(false);
  const [selectedItem, setSelected] = useState(null);
  const [stockDelta, setStockDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("recount");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBatchId, setAdjustBatchId] = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);

  // Adjustment Logs
  const [showLogsModal, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [adjustLogs, setAdjustLogs] = useState([]);

  // Tabs & Global Logs
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog" | "logs"
  const [globalLogs, setGlobalLogs] = useState([]);
  const [globalLogsLoading, setGlobalLogsLoading] = useState(false);

  const fetchGlobalLogs = async () => {
    setGlobalLogsLoading(true);
    try {
      const { data } = await api.get("/inventory/adjustments/all");
      setGlobalLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGlobalLogsLoading(false);
    }
  };

  const fetchAll = async (q = search) => {
    setLoading(true);
    try {
      const [itemsRes, lowRes, invRes] = await Promise.all([
        api.get("/inventory/", { params: q ? { search: q } : {} }),
        api.get("/inventory/low-stock"),
        api.get("/analytics/predictions/inventory"),
      ]);
      setItems(itemsRes.data);
      setLowStock(lowRes.data);
      setInventoryForecast(invRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "catalog") {
      fetchAll("");
    } else if (activeTab === "logs") {
      fetchGlobalLogs();
    }
  }, [activeTab]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const openAdd = () => { setShowAdd(true); setFormError(""); setForm(EMPTY_FORM); };

  const openEdit = (item) => {
    setEditItem(item);
    setFormError("");
    setForm({
      name: item.name ?? "",
      brand: (item.compatible_brands || [])[0] ?? "",
      model: (item.compatible_models || [])[0] ?? "",
      category: item.category ?? "",
      spec: "",
      part_type: item.part_type ?? "factory_new",
      min_stock_threshold: String(item.min_stock_threshold ?? "2"),
      supplier: item.supplier ?? "",
      track_serial: !!item.track_serial,
      compatible_brands: item.compatible_brands || [],
      compatible_models: item.compatible_models || [],
      quantity: "", unit_price: "",
    });
  };

  /** Merge a primary value into a list, de-duplicated case-insensitively (primary first). */
  const mergeUnique = (primary, list) => {
    const out = [];
    const seen = new Set();
    [primary, ...list].forEach((v) => {
      const val = (v || "").trim();
      if (val && !seen.has(val.toLowerCase())) { seen.add(val.toLowerCase()); out.push(val); }
    });
    return out;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    const generatedName = buildPartName(form);
    if (!form.brand.trim() || !form.model.trim() || !form.category.trim()) {
      setFormError("Select a brand and model, and enter a category, to generate the part name.");
      return;
    }
    const existingItem = items.find(i => i.name === generatedName && i.part_type === form.part_type);
    if (existingItem) {
      setFormError(
        <span className="flex flex-col gap-2">
          <span>This part already exists in your inventory (SKU: <strong>{existingItem.sku}</strong>). To add stock to it, please receive a batch instead of creating a new part.</span>
          <button type="button" onClick={() => { setShowAdd(false); openReceive(existingItem); }} 
            className="self-start px-3 py-1.5 bg-red-100 text-red-800 rounded font-semibold text-xs hover:bg-red-200 transition-colors">
            Switch to Receive Stock
          </button>
        </span>
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: generatedName,
        category: form.category,
        part_type: form.part_type,
        min_stock_threshold: parseInt(form.min_stock_threshold, 10) || 0,
        track_serial: form.track_serial,
        supplier: form.supplier || null,
        compatible_brands: mergeUnique(form.brand, form.compatible_brands),
        compatible_models: mergeUnique(form.model, form.compatible_models),
      };
      if (form.quantity) payload.quantity = parseInt(form.quantity, 10);
      if (form.unit_cost) payload.unit_cost = parseFloat(form.unit_cost);
      if (form.unit_price) payload.unit_price = parseFloat(form.unit_price);
      const { data: created } = await api.post("/inventory/", payload);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await fetchAll(search);
      // If initial stock was entered, a first batch was created — offer its QR label.
      const firstBatch = created?.batches?.[0];
      if (firstBatch) {
        setLabelPrompt({
          code: firstBatch.batch_code, sku: created.sku, name: created.name,
          supplier: firstBatch.supplier, qty: firstBatch.quantity_received, unitCost: firstBatch.unit_cost,
        });
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && detail.msg === "DUPLICATE_PART") {
        setFormError(
          <span className="flex flex-col gap-2">
            <span>This part already exists in your inventory (SKU: <strong>{detail.sku}</strong>). To add stock to it, please receive a batch instead of creating a new part.</span>
            <button type="button" onClick={() => { setShowAdd(false); openReceive({ id: detail.item_id, sku: detail.sku, name: generatedName }); }} 
              className="self-start px-3 py-1.5 bg-red-100 text-red-800 rounded font-semibold text-xs hover:bg-red-200 transition-colors">
              Switch to Receive Stock
            </button>
          </span>
        );
      } else {
        setFormError(typeof detail === "string" ? detail : "Failed to add item");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    const generatedName = buildPartName(form);
    if (!form.brand.trim() || !form.model.trim() || !form.category.trim()) {
      setFormError("Select a brand and model, and enter a category, to generate the part name.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/inventory/${editItem.id}`, {
        name: generatedName,
        category: form.category,
        part_type: form.part_type,
        min_stock_threshold: parseInt(form.min_stock_threshold, 10) || 0,
        track_serial: form.track_serial,
        supplier: form.supplier || null,
        compatible_brands: mergeUnique(form.brand, form.compatible_brands),
        compatible_models: mergeUnique(form.model, form.compatible_models),
      });
      setEditItem(null);
      setForm(EMPTY_FORM);
      fetchAll(search);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const openReceive = (item) => {
    setReceiveItem(item);
    setReceiveForm({ supplier: item.supplier ?? "", unit_cost: "", margin: "30", new_selling_price: item.unit_price ?? "", quantity: "", purchased_at: new Date().toISOString().split("T")[0], update_selling_price: false });
    setFormError("");
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        supplier: receiveForm.supplier || null,
        unit_cost: parseFloat(receiveForm.unit_cost),
        quantity: parseInt(receiveForm.quantity, 10),
      };
      if (receiveForm.update_selling_price && receiveForm.new_selling_price) {
        payload.new_selling_price = parseFloat(receiveForm.new_selling_price);
      }
      if (receiveForm.purchased_at) payload.purchased_at = new Date(receiveForm.purchased_at).toISOString();
      const { data: batch } = await api.post(`/inventory/${receiveItem.id}/receive`, payload);
      const item = receiveItem;
      setReceiveItem(null);
      await fetchAll(search);
      setLabelPrompt({
        title: "Stock Received", action: "received",
        code: batch.batch_code, sku: item.sku, name: item.name,
        supplier: batch.supplier, qty: batch.quantity_received, unitCost: batch.unit_cost,
      });
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to receive stock");
    } finally {
      setSaving(false);
    }
  };

  const openItemDetails = async (item) => {
    setDetailsItem(item);
    setBatches([]);
    setBatchLoading(true);
    try {
      const { data } = await api.get(`/inventory/${item.id}/batches`);
      setBatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/inventory/${selectedItem.id}/stock`, {
        delta: parseInt(stockDelta, 10),
        reason: adjustReason,
        note: adjustNote || null,
        batch_id: adjustBatchId || null,
      });
      setShowStock(false);
      setStockDelta("");
      setAdjustReason("recount");
      setAdjustNote("");
      setAdjustBatchId("");
      fetchAll(search);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  const openLogs = async (item) => {
    setSelected(item);
    setAdjustLogs([]);
    setLogsLoading(true);
    setShowLogs(true);
    try {
      const { data } = await api.get(`/inventory/${item.id}/adjustments`);
      setAdjustLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Inventory Manager</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{items.length} parts catalogued</p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Add Part
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 mt-2">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "catalog"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600"
          }`}
        >
          Inventory Catalog
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "logs"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600"
          }`}
        >
          Adjustment Logs
        </button>
      </div>

      {activeTab === "catalog" ? (
        <>
          {inventoryForecast && inventoryForecast.filter(i => i.status === "critical" || i.status === "warning").length > 0 && (
            <section className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Smart Alerts: Inventory Demand Prediction</h3>
              <AutoSlidingAlerts alerts={inventoryForecast.filter(i => i.status === "critical" || i.status === "warning")} />
            </section>
          )}

          {/* Low Stock Alerts */}
          {lowStock.length > 0 && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <p className="text-sm text-amber-800 font-medium">
                Low Stock —{" "}
                {lowStock.length} part{lowStock.length > 1 ? "s are" : " is"} below minimum stock:{" "}
                <span className="font-semibold">{lowStock.map((i) => i.name).join(", ")}</span>
              </p>
            </div>
          )}

          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); fetchAll(search); }} className="mb-5 flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU or category…"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium">Search</button>
            {search && (
              <button type="button" onClick={() => { setSearch(""); fetchAll(""); }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Clear</button>
            )}
          </form>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mx-4 my-4">
            <p className="font-medium text-gray-500 dark:text-gray-400">No inventory items</p>
            <p className="text-sm text-gray-400 mt-1">Add your first spare part above</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {["SKU", "Part Name", "Category", "Type", "Qty", "Latest Cost", "Min", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => openItemDetails(item)}
                  className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors ${item.is_low_stock ? "bg-amber-50/40" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{item.sku || "—"}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {item.name}
                    {item.track_serial && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-semibold">SERIAL</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.part_type === "factory_new" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {item.part_type === "factory_new" ? "Factory New" : "Salvaged"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-100">{item.quantity}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">LKR {Number(item.unit_price).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{item.min_stock_threshold}</td>
                  <td className="px-4 py-3">
                    {item.is_low_stock ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Low Stock</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          {globalLogsLoading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Loading logs…</div>
          ) : globalLogs.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">No adjustments have been recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Item Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Batch Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Change</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {globalLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{log.admin_name}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{log.item_name}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400">{log.batch_code || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${log.delta > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {log.delta > 0 ? "+" : ""}{log.delta}
                      </span>
                    </td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-gray-600 dark:text-gray-300">{log.reason}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 italic max-w-xs truncate" title={log.note}>{log.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Part Modal */}
      <Modal open={showAddModal} onClose={() => setShowAdd(false)} title="Add Inventory Part">
        <form onSubmit={handleAdd} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
          <CatalogFormFields form={form} handleChange={handleChange} setForm={setForm} showInitialStock categories={categories} />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors">{saving ? "Adding…" : "Add Part"}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Part Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title={`Edit Part — ${editItem?.name ?? ""}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
          <CatalogFormFields form={form} handleChange={handleChange} setForm={setForm} showInitialStock={false} categories={categories} />
          <p className="text-xs text-gray-400">Stock &amp; cost are managed through purchase batches (use “Receive”).</p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors">{saving ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </Modal>

      {/* QR label print prompt */}
      <Modal open={!!labelPrompt} onClose={() => setLabelPrompt(null)} title={labelPrompt?.title || "Part Added"}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Batch <span className="font-mono font-semibold text-gray-800 dark:text-gray-100">{labelPrompt?.code}</span> was {labelPrompt?.action || "created"}.
            Print a QR label for this batch?
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setLabelPrompt(null)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Not now</button>
            <button type="button"
              onClick={() => { const p = labelPrompt; setLabelPrompt(null); if (p) printLabel(p); }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors">Print Label</button>
          </div>
        </div>
      </Modal>

      {/* Receive Stock Modal */}
      <Modal open={!!receiveItem} onClose={() => setReceiveItem(null)} title={`Receive Stock — ${receiveItem?.name ?? ""}`}>
        <form onSubmit={handleReceive} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            SKU <span className="font-mono">{receiveItem?.sku}</span> · current stock <strong>{receiveItem?.quantity}</strong>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
              <input type="number" min="1" required value={receiveForm.quantity}
                onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Unit Cost (LKR) *</label>
              <input type="number" step="0.01" min="0" required value={receiveForm.unit_cost}
                onChange={(e) => {
                  const cost = parseFloat(e.target.value) || 0;
                  const margin = parseFloat(receiveForm.margin) || 0;
                  const price = (cost * (1 + margin / 100)).toFixed(2);
                  setReceiveForm((f) => ({ ...f, unit_cost: e.target.value, new_selling_price: price }));
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Margin % (For update)</label>
              <select value={receiveForm.margin} onChange={(e) => {
                const margin = parseFloat(e.target.value) || 0;
                const cost = parseFloat(receiveForm.unit_cost) || 0;
                const price = (cost * (1 + margin / 100)).toFixed(2);
                setReceiveForm((f) => ({ ...f, margin: e.target.value, new_selling_price: price }));
              }} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="30">30%</option>
                <option value="50">50%</option>
                <option value="100">100%</option>
                <option value="0">Custom (0%)</option>
              </select>
            </div>
            <div className="col-span-2 border-t pt-3 mt-1">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={receiveForm.update_selling_price} 
                  onChange={(e) => setReceiveForm(f => ({ ...f, update_selling_price: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Update Selling Price? (Current: LKR {receiveItem?.unit_price})</span>
              </label>
              {receiveForm.update_selling_price && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Selling Price (LKR)</label>
                  <input type="number" step="0.01" min="0" required value={receiveForm.new_selling_price}
                    onChange={(e) => setReceiveForm((f) => ({ ...f, new_selling_price: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Supplier</label>
              <SupplierSelect
                value={receiveForm.supplier}
                onChange={(v) => setReceiveForm((f) => ({ ...f, supplier: v }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Purchased At</label>
              <input type="date" max={new Date().toISOString().split("T")[0]} value={receiveForm.purchased_at}
                onChange={(e) => setReceiveForm((f) => ({ ...f, purchased_at: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setReceiveItem(null)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors">{saving ? "Saving…" : "Receive & Create Batch"}</button>
          </div>
        </form>
      </Modal>

      {/* Item Details Modal */}
      <Modal open={!!detailsItem} onClose={() => setDetailsItem(null)} title={`Part Details — ${detailsItem?.name ?? ""}`}>
        {detailsItem && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
              <button onClick={() => { setDetailsItem(null); openReceive(detailsItem); }} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-semibold transition-colors">
                Receive Stock
              </button>
              <button onClick={async () => {
                setDetailsItem(null);
                setSelected(detailsItem);
                setStockDelta("");
                setAdjustReason("recount");
                setAdjustNote("");
                setAdjustBatchId("");
                try {
                  const { data } = await api.get(`/inventory/${detailsItem.id}/batches`);
                  setAvailableBatches(data);
                } catch(e) { setAvailableBatches([]); }
                setShowStock(true);
              }} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors">
                Adjust Stock
              </button>
              <button onClick={() => { setDetailsItem(null); openLogs(detailsItem); }} className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-semibold transition-colors">
                View Logs
              </button>
              <button onClick={() => {
                setDetailsItem(null);
                openEdit(detailsItem);
              }} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors">
                Edit Part
              </button>
            </div>

            {/* Batches List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Available Batches</h3>
              {batchLoading ? (
                <div className="py-8 text-center text-gray-400 text-sm">Loading batches…</div>
              ) : batches.length === 0 ? (
                <p className="py-6 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">No batches currently available. Use "Receive Stock" to add inventory.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {batches.map((b) => (
                    <div key={b.id} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex items-center justify-between bg-white dark:bg-gray-800">
                      <div>
                        <p className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">{b.batch_code}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {b.supplier || "—"} · LKR {Number(b.unit_cost).toLocaleString()} ·
                          <span className="font-semibold text-gray-700 dark:text-gray-200"> {b.quantity_remaining}</span> / {b.quantity_received} left
                        </p>
                      </div>
                      <button
                        onClick={() => printLabel({ code: b.batch_code, sku: detailsItem.sku, name: detailsItem.name, supplier: b.supplier, qty: b.quantity_received, unitCost: b.unit_cost })}
                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-2 py-1 hover:bg-blue-50 rounded transition-colors">
                        Label
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal open={showStockModal} onClose={() => setShowStock(false)} title={`Adjust Stock — ${selectedItem?.name}`}>
        <form onSubmit={handleStockAdjust} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Current stock: <strong className="text-gray-800 dark:text-gray-100">{selectedItem?.quantity}</strong></p>
          <p className="text-xs text-gray-400">Use for recounts/shrinkage. Negative deducts oldest batches first.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Reason for Adjustment *</label>
            <select required value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="recount">Physical Recount Correction</option>
              <option value="damaged">Damaged / Broken</option>
              <option value="shrinkage">Lost / Missing</option>
              <option value="returned">Returned to Inventory</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Stock Change (positive = add, negative = consume) *</label>
            <input type="number" required value={stockDelta} onChange={(e) => setStockDelta(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. +5 or -2" />
          </div>
          {parseInt(stockDelta, 10) < 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Batch to Deduct From (Optional)</label>
              <select value={adjustBatchId} onChange={(e) => setAdjustBatchId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Automatic (Oldest First) --</option>
                {availableBatches.filter(b => b.quantity_remaining > 0).map(b => (
                  <option key={b.id} value={b.id}>
                    Batch {b.batch_code} ({b.quantity_remaining} left)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">If selected, the stock will be removed strictly from this batch.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes (Optional)</label>
            <textarea value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Explain the reason..." rows={2} />
          </div>
          {stockDelta && (
            <p className="text-xs text-gray-500 dark:text-gray-400">New quantity: <strong>{(selectedItem?.quantity ?? 0) + (parseInt(stockDelta, 10) || 0)}</strong></p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowStock(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors">{saving ? "Saving…" : "Update Stock"}</button>
          </div>
        </form>
      </Modal>

      {/* Adjustment Logs Modal */}
      <Modal open={showLogsModal} onClose={() => setShowLogs(false)} title={`Adjustment Logs — ${selectedItem?.name}`}>
        {logsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading logs...</p>
        ) : adjustLogs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No manual adjustments recorded for this item.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {adjustLogs.map((log) => (
              <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${log.delta > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {log.delta > 0 ? "+" : ""}{log.delta}
                    </span>
                    <span className="ml-2 text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">{log.reason}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(log.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">By {log.admin_name}</p>
                  </div>
                </div>
                {log.batch_code && (
                  <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mb-1">Batch: {log.batch_code}</p>
                )}
                {log.note && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">{log.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
