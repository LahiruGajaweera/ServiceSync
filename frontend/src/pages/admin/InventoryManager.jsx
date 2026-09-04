import React, { useEffect, useState, useMemo, Fragment } from "react";
import QRCode from "qrcode";
import api from "../../services/api";
import BrandSelect from "../../components/BrandSelect";
import ModelSelect from "../../components/ModelSelect";
import SpecSelect from "../../components/SpecSelect";
import MultiSelect from "../../components/MultiSelect";
import SupplierSelect from "../../components/SupplierSelect";
import AlertCard from "../../components/AlertCard";
import AutoSlidingAlerts from "../../components/AutoSlidingAlerts";
function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  const sizeClass = size === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full ${sizeClass} max-h-[90vh] overflow-y-auto hide-scrollbar`}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
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
  quantity: "", unit_cost: "", margin: "0", unit_price: "",
};

const EMPTY_RECEIVE = { supplier: "", unit_cost: "", margin: "0", new_selling_price: "", quantity: "", purchased_at: new Date().toISOString().split("T")[0], update_selling_price: false };

/** Open a printable QR label for an array of labels. */
async function printLabels(labels) {
  const htmlParts = [];
  for (const label of labels) {
    let qr = "";
    try {
      qr = await QRCode.toDataURL(label.code, { width: 220, margin: 1 });
    } catch {
      qr = "";
    }
    htmlParts.push(`
      <div class="label">
        <div class="name">${label.name || ""}</div>
        <div class="sku">${label.sku || ""}</div>
        ${qr ? `<img class="qr" src="${qr}" width="160" height="160" alt="QR" />` : ""}
        <div class="code">${label.code}</div>
        <div class="meta">
          ${label.supplier ? `Supplier: ${label.supplier}<br/>` : ""}
          ${label.qty != null ? `Qty: ${label.qty}` : ""}${label.unitCost != null ? ` &nbsp;·&nbsp; LKR ${Number(label.unitCost).toLocaleString()}` : ""}
        </div>
      </div>
    `);
  }

  const win = window.open("", "PrintLabel", "width=380,height=460");
  if (!win) {
    alert("Please allow pop-ups to print the label.");
    return;
  }
  win.document.write(`<!doctype html><html><head><title>Print Labels</title>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111827; margin: 0; padding: 16px; }
      .label { width: 280px; margin: 0 auto 20px; border: 1px solid #111827; border-radius: 10px; padding: 14px; text-align: center; page-break-after: always; }
      .name { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
      .sku { font-size: 11px; color: #6b7280; letter-spacing: .5px; }
      .qr { margin: 10px auto 6px; }
      .code { font-size: 15px; font-weight: 800; letter-spacing: 1px; }
      .meta { font-size: 11px; color: #374151; margin-top: 6px; line-height: 1.5; }
      @media print {
        body { padding: 0; margin: 0; }
        .label { border: none; margin: 0; width: 100%; height: 100vh; padding: 0; border-radius: 0; display: flex; flex-direction: column; justify-content: center; }
      }
    </style></head><body>
    ${htmlParts.join("\\n")}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

/** Build a consistent, traceable part name from its attributes:
 *  "{Brand} {Model} {Category} {Spec}" using the dedicated brand & model selection. */
function buildPartName(form) {
  return [form.brand, form.model, form.category, form.spec]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
}

function parseLogNote(note) {
  if (!note) return { serial: "—", text: "—" };
  const match = note.match(/^Serial (.*?):\s*(.*)$/);
  if (match) {
    return { serial: match[1], text: match[2] || "—" };
  }
  const match2 = note.match(/^Serial (.*?)$/);
  if (match2) {
    return { serial: match2[1], text: "—" };
  }
  return { serial: "—", text: note };
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

      <div className="col-span-2 mt-1 border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {showInitialStock ? "Initial Stock & Pricing (optional)" : "Inventory & Pricing Settings"}
        </p>
        {showInitialStock && (
          <p className="text-xs text-gray-400">Creates the first purchase batch and sets the base selling price.</p>
        )}
      </div>

      <div className="col-span-2 flex items-center pb-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <input name="track_serial" type="checkbox" checked={form.track_serial} onChange={handleChange}
            className="rounded border-gray-300 dark:border-gray-600" disabled={!showInitialStock && form.track_serial} />
          Track each unit (serial)
        </label>
      </div>

      {showInitialStock && (
        <>
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
        </>
      )}

      <div className={`col-span-2 grid gap-4 ${showInitialStock ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Min Stock Threshold</label>
          <input name="min_stock_threshold" type="number" min="0" value={form.min_stock_threshold} onChange={handleChange}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        
        {showInitialStock && (
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
              <option value="0">Custom</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Selling Price (LKR) *</label>
          <input name="unit_price" type="number" step="0.01" min="0" required value={form.unit_price} onChange={(e) => {
            handleChange(e);
            setForm((f) => ({ ...f, margin: "0" }));
          }}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 dark:bg-blue-900/30" />
        </div>
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
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Supplier Info</p>
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
  const [technicians, setTechnicians] = useState([]);
  const [inventoryForecast, setInventoryForecast] = useState([]);
  const [search, setSearch]         = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [filterType, setFilterType] = useState("all");
  const [showAddModal, setShowAdd]  = useState(false);

  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState("");
  const [labelPrompt, setLabelPrompt] = useState(null);
  const [saving, setSaving]         = useState(false);

  // Expandable Row & Tabs
  const [detailsItem, setDetailsItem] = useState(null);
  const [expandedTab, setExpandedTab] = useState("batches"); // "batches", "receive", "adjust", "logs"
  
  // Receive stock
  const [receiveForm, setReceiveForm] = useState(EMPTY_RECEIVE);

  // Batches viewer
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState(null);

  // Adjust stock
  const [stockDelta, setStockDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("recount");
  const [adjustTechnician, setAdjustTechnician] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBatchId, setAdjustBatchId] = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);

  // Serial Unit Adjust
  const [unitToAdjust, setUnitToAdjust] = useState(null);
  const [unitAdjustSerialNumber, setUnitAdjustSerialNumber] = useState("");
  const [showSerialDropdown, setShowSerialDropdown] = useState(false);
  const [unitAdjustStatus, setUnitAdjustStatus] = useState("lost");
  const [unitAdjustReason, setUnitAdjustReason] = useState("recount");
  const [unitAdjustTechnician, setUnitAdjustTechnician] = useState("");
  const [unitAdjustNote, setUnitAdjustNote] = useState("");

  // Adjustment Logs
  const [logsLoading, setLogsLoading] = useState(false);
  const [adjustLogs, setAdjustLogs] = useState([]);

  // Tabs & Global Logs
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog" | "logs" | "salvage"
  const [globalLogs, setGlobalLogs] = useState([]);
  const [globalLogsLoading, setGlobalLogsLoading] = useState(false);
  
  // Salvage Parts
  const [salvagedParts, setSalvagedParts] = useState([]);
  const [salvagedLoading, setSalvagedLoading] = useState(false);

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

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, lowRes, invRes, usersRes] = await Promise.all([
        api.get("/inventory/"),
        api.get("/inventory/low-stock"),
        api.get("/analytics/predictions/inventory"),
        api.get("/users/"),
      ]);
      setItems(itemsRes.data);
      setLowStock(lowRes.data);
      setInventoryForecast(invRes.data);
      setTechnicians(usersRes.data.filter((u) => u.role === "technician"));
    } finally {
      setLoading(false);
    }
  };

  const fetchSalvagedParts = async () => {
    setSalvagedLoading(true);
    try {
      const { data } = await api.get("/donors/parts/available");
      setSalvagedParts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvagedLoading(false);
    }
  };

  const processedItems = useMemo(() => {
    let result = [...items];
    
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        (item.name || "").toLowerCase().includes(q) ||
        (item.sku || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    }
    
    // Filter
    if (filterType === "low_stock") {
      result = result.filter(item => item.is_low_stock);
    } else if (filterType === "factory_new") {
      result = result.filter(item => item.part_type === "factory_new");
    } else if (filterType === "salvaged") {
      result = result.filter(item => item.part_type === "salvaged");
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, search, filterType, sortConfig]);

  useEffect(() => {
    if (activeTab === "catalog") {
      fetchAll();
    } else if (activeTab === "logs") {
      fetchGlobalLogs();
    } else if (activeTab === "salvage") {
      fetchSalvagedParts();
    }
  }, [activeTab]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const openAdd = () => { setShowAdd(true); setFormError(""); setForm(EMPTY_FORM); };


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
      if (form.quantity && !form.track_serial) payload.quantity = parseInt(form.quantity, 10);
      if (form.unit_cost && !form.track_serial) payload.unit_cost = parseFloat(form.unit_cost);
      if (form.unit_price) payload.unit_price = parseFloat(form.unit_price);
      const { data: created } = await api.post("/inventory/", payload);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await fetchAll();
      // If initial stock was entered, a first batch was created — offer its QR label.
      const firstBatch = created?.batches?.[0];
      if (firstBatch) {
        setLabelPrompt({
          code: firstBatch.batch_code, sku: created.sku, name: created.name,
          supplier: firstBatch.supplier, qty: firstBatch.quantity_received, unitCost: firstBatch.unit_cost,
        });
      } else if (created.track_serial) {
        openReceive(created, {
          quantity: form.quantity,
          unit_cost: form.unit_cost,
          supplier: form.supplier,
          margin: form.margin,
          unit_price: form.unit_price
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
        setFormError(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(d => `${d.loc?.[d.loc?.length - 1] || 'Field'}: ${d.msg}`).join(", ") : "Failed to add item");
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
      await api.patch(`/inventory/${detailsItem.id}`, {
        name: generatedName,
        category: form.category,
        part_type: form.part_type,
        min_stock_threshold: parseInt(form.min_stock_threshold, 10) || 0,
        track_serial: form.track_serial,
        supplier: form.supplier || null,
        compatible_brands: mergeUnique(form.brand, form.compatible_brands),
        compatible_models: mergeUnique(form.model, form.compatible_models),
      });
      setExpandedTab("batches");
      setForm(EMPTY_FORM);
      fetchAll();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(d => `${d.loc?.[d.loc?.length - 1] || 'Field'}: ${d.msg}`).join(", ") : "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const openItemDetails = async (item, forceTab = "batches") => {
    if (detailsItem?.id === item.id && expandedTab === forceTab) {
      setDetailsItem(null);
      return;
    }
    setDetailsItem(item);
    setExpandedTab(forceTab);
    
    if (forceTab === "batches") {
      setBatches([]);
      setBatchLoading(true);
      try {
        const { data } = await api.get(`/inventory/${item.id}/batches`);
        setBatches(data);
      } catch (err) { console.error(err); } 
      finally { setBatchLoading(false); }
    } else if (forceTab === "receive") {
      setReceiveForm({ 
        supplier: item.supplier ?? "", 
        unit_cost: "", 
        margin: "0", 
        new_selling_price: item.unit_price ?? "", 
        quantity: "", 
        purchased_at: new Date().toISOString().split("T")[0], 
        update_selling_price: false, 
        serial_numbers: [] 
      });
      setFormError("");
    } else if (forceTab === "adjust") {
      setStockDelta("");
      setAdjustReason("recount");
      setAdjustNote("");
      setAdjustBatchId("");
      setUnitAdjustSerialNumber("");
      setUnitAdjustStatus("lost");
      setUnitAdjustReason("recount");
      setUnitAdjustNote("");
      try {
        const { data } = await api.get(`/inventory/${item.id}/batches`);
        setAvailableBatches(data);
      } catch(e) { setAvailableBatches([]); }
    } else if (forceTab === "logs") {
      setAdjustLogs([]);
      setLogsLoading(true);
      try {
        const { data } = await api.get(`/inventory/${item.id}/adjustments`);
        setAdjustLogs(data);
      } catch (err) { console.error(err); } 
      finally { setLogsLoading(false); }
    } else if (forceTab === "edit") {
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
      setFormError("");
    }
  };

  const openReceive = (item, initialData = {}) => {
    setDetailsItem(item);
    setExpandedTab("receive");
    setReceiveForm({ 
      supplier: initialData.supplier ?? item.supplier ?? "", 
      unit_cost: initialData.unit_cost ?? "", 
      margin: initialData.margin ?? "0", 
      new_selling_price: initialData.unit_price ?? item.unit_price ?? "", 
      quantity: initialData.quantity ?? "", 
      purchased_at: new Date().toISOString().split("T")[0], 
      update_selling_price: false, 
      serial_numbers: Array(parseInt(initialData.quantity || 0, 10)).fill("") 
    });
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
      if (detailsItem.track_serial) payload.serial_numbers = (receiveForm.serial_numbers || []).filter(s => s.trim());
      
      const { data: batch } = await api.post(`/inventory/${detailsItem.id}/receive`, payload);
      const item = detailsItem;
      await fetchAll();
      openItemDetails(item, "batches");
      setLabelPrompt({
        title: "Stock Received", action: "received",
        code: batch.batch_code, sku: item.sku, name: item.name,
        supplier: batch.supplier, qty: batch.quantity_received, unitCost: batch.unit_cost,
        serialNumbers: payload.serial_numbers || [],
      });
    } catch (err) {
      console.error("Receive error:", err.response?.data);
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(d => `${JSON.stringify(d.loc)}: ${d.msg}`).join(", ") : "Failed to receive stock");
    } finally {
      setSaving(false);
    }
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (detailsItem?.track_serial) {
        let finalNote = unitAdjustNote;
        if (unitAdjustReason === "broken_by_technician" && unitAdjustTechnician) {
          finalNote = `Broken by Technician: ${unitAdjustTechnician}` + (unitAdjustNote ? `\n${unitAdjustNote}` : "");
        }
        await api.post(`/inventory/units/${unitAdjustSerialNumber}/status`, {
          status: unitAdjustStatus,
          reason: unitAdjustReason,
          note: finalNote || null,
        });
      } else {
        let finalNote = adjustNote;
        if (adjustReason === "broken_by_technician" && adjustTechnician) {
          finalNote = `Broken by Technician: ${adjustTechnician}` + (adjustNote ? `\n${adjustNote}` : "");
        }
        await api.patch(`/inventory/${detailsItem.id}/stock`, {
          delta: parseInt(stockDelta, 10),
          reason: adjustReason,
          note: finalNote || null,
          batch_id: adjustBatchId || null,
        });
      }
      await fetchAll();
      openItemDetails(detailsItem, "batches");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to adjust stock");
    } finally {
      setSaving(false);
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
          onClick={() => setActiveTab("salvage")}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "salvage"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600"
          }`}
        >
          Salvaged Parts
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

          {/* Controls Bar */}
          <div className="mb-5 flex flex-wrap gap-3 items-center">
            <div className="relative max-w-sm w-full">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU or category…"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100" />
              <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              )}
            </div>
            
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              <option value="all">All Parts</option>
              <option value="low_stock">Low Stock Only</option>
              <option value="factory_new">Factory New</option>
              <option value="salvaged">Salvaged</option>
            </select>

            <select value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
              const [key, direction] = e.target.value.split('-');
              setSortConfig({ key, direction });
            }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="quantity-desc">Stock (High to Low)</option>
              <option value="quantity-asc">Stock (Low to High)</option>
              <option value="unit_price-desc">Price (Highest)</option>
              <option value="unit_price-asc">Price (Lowest)</option>
            </select>
          </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : processedItems.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mx-4 my-4">
            <p className="font-medium text-gray-500 dark:text-gray-400">No inventory items</p>
            <p className="text-sm text-gray-400 mt-1">Add your first spare part above</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {["SKU", "Part Name", "Category", "Type", "Qty", "Latest Selling Price", "Min", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {processedItems.map((item) => (
                <React.Fragment key={item.id}>
                  <tr 
                    onClick={() => openItemDetails(item, "batches")}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors ${item.is_low_stock ? "bg-amber-50/40" : ""} ${detailsItem?.id === item.id ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
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
                    <td className="px-4 py-3 flex items-center justify-between">
                      {item.is_low_stock ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Low Stock</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">OK</span>
                      )}
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${detailsItem?.id === item.id ? 'rotate-180 text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </td>
                  </tr>
                  
                  {detailsItem?.id === item.id && (
                    <tr>
                      <td colSpan={8} className="p-0 border-b-2 border-blue-200 dark:border-blue-900/50">
                        <div className="bg-white dark:bg-gray-800 shadow-[inset_0_4px_6px_-4px_rgba(0,0,0,0.1)]">
                          <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 pt-3 bg-gray-50/80 dark:bg-gray-900/80">
                            {[
                              { id: "batches", label: "Batches & Stock" },
                              { id: "receive", label: "Receive Stock" },
                              { id: "adjust", label: "Adjust Stock" },
                              { id: "logs", label: "Logs" },
                              { id: "edit", label: "Edit Part" },
                            ].map(tab => (
                              <button key={tab.id} onClick={() => openItemDetails(item, tab.id)}
                                className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 rounded-t-lg ${expandedTab === tab.id ? "border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"}`}>
                                {tab.label}
                              </button>
                            ))}
                            <div className="flex-1" />
                          </div>
                          
                          <div className="p-6">
                            {expandedTab === "batches" && (
                              <div>
                                {batchLoading ? (
                                  <div className="py-8 text-center text-gray-400 text-sm">Loading batches…</div>
                                ) : batches.length === 0 ? (
                                  <p className="py-6 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">No batches currently available. Use "Receive Stock" to add inventory.</p>
                                ) : (
                                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 hide-scrollbar">
                                    {batches.map((b) => (
                                      <div key={b.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                                        <div 
                                          className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${expandedBatchId === b.id ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                          onClick={() => setExpandedBatchId(expandedBatchId === b.id ? null : b.id)}
                                        >
                                          <div>
                                            <p className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                              {b.batch_code}
                                              <span className="text-gray-400">
                                                <svg className={`w-4 h-4 transition-transform ${expandedBatchId === b.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                              </span>
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                              {b.supplier || "—"} · Buy: LKR {Number(b.unit_cost).toLocaleString()} · Sell: LKR {Number(detailsItem.unit_price).toLocaleString()} ·
                                              <span className="font-semibold text-gray-700 dark:text-gray-200"> {b.quantity_remaining}</span> / {b.quantity_received} left
                                            </p>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              printLabels([{ code: b.batch_code, sku: detailsItem.sku, name: detailsItem.name, supplier: b.supplier, qty: b.quantity_received, unitCost: b.unit_cost }]);
                                            }}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-3 py-1.5 hover:bg-blue-100 rounded-lg transition-colors bg-blue-50">
                                            Print Batch Label
                                          </button>
                                        </div>
                                        {expandedBatchId === b.id && b.units && b.units.length > 0 && (
                                          <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                                            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Serial Numbers in Batch</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                              {b.units.map(u => (
                                                <div key={u.serial_number} className={`flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-gray-800 ${u.status === 'in_stock' ? 'border-green-200' : 'border-gray-200'}`}>
                                                  <div>
                                                    <span className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 block">{u.serial_number}</span>
                                                    <span className={`text-[10px] font-semibold ${u.status === 'in_stock' ? 'text-green-600' : 'text-gray-500'}`}>
                                                      {u.status === 'in_stock' ? 'In Stock' : u.status === 'lost' ? 'Lost' : 'Returned'}
                                                    </span>
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      printLabels([{ code: u.serial_number, sku: detailsItem.sku, name: detailsItem.name, supplier: b.supplier, qty: 1, unitCost: b.unit_cost }]);
                                                    }}
                                                    className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-[10px] font-semibold transition-colors">
                                                    Print
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {expandedBatchId === b.id && (!b.units || b.units.length === 0) && (
                                          <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30 text-center text-xs text-gray-400 italic">
                                            No serial numbers recorded for this batch.
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {expandedTab === "receive" && (
                              <div className="max-w-3xl mx-auto">
                                <form onSubmit={handleReceive} className="space-y-4">
                                  {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
                                      <input type="number" min="1" required value={receiveForm.quantity}
                                        onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    {detailsItem?.track_serial && (
                                      <div className="col-span-2">
                                        <div className="flex items-center justify-between mb-2">
                                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                                            Serial Numbers * 
                                            <span className="text-gray-400 font-normal ml-2">(Scan or type each one)</span>
                                          </label>
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              const qty = parseInt(receiveForm.quantity, 10);
                                              if (!qty || qty <= 0) return;
                                              const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                                              const base = detailsItem?.sku ? detailsItem.sku : "SN";
                                              const newSerials = [];
                                              for (let i = 0; i < qty; i++) {
                                                const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
                                                newSerials.push(`${base}-${dateStr}-${randomStr}`);
                                              }
                                              setReceiveForm(f => ({ ...f, serial_numbers: newSerials }));
                                            }}
                                            className="px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-[11px] font-semibold transition-colors"
                                          >
                                            Auto-Generate
                                          </button>
                                        </div>
                                        {!receiveForm.quantity || parseInt(receiveForm.quantity, 10) <= 0 ? (
                                          <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-200">
                                            Please enter a valid Quantity first.
                                          </div>
                                        ) : (
                                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                            {Array.from({ length: parseInt(receiveForm.quantity, 10) }).map((_, i) => (
                                              <input
                                                key={i}
                                                id={`serial-input-${i}`}
                                                required
                                                value={receiveForm.serial_numbers[i] || ""}
                                                onChange={(e) => {
                                                  const newSerials = [...receiveForm.serial_numbers];
                                                  newSerials[i] = e.target.value;
                                                  setReceiveForm(f => ({ ...f, serial_numbers: newSerials }));
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const nextInput = document.getElementById(`serial-input-${i + 1}`);
                                                    if (nextInput) nextInput.focus();
                                                  }
                                                }}
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white dark:bg-gray-800"
                                                placeholder={`Serial number ${i + 1}`}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        <p className="text-[11px] text-gray-500 mt-2">Must provide exactly {receiveForm.quantity || 0} serial numbers.</p>
                                      </div>
                                    )}
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Unit Cost (LKR) *</label>
                                      <input type="number" step="0.01" min="0" required value={receiveForm.unit_cost}
                                        onChange={(e) => {
                                          const cost = e.target.value;
                                          const m = parseFloat(receiveForm.margin) || 0;
                                          const price = cost && receiveForm.update_selling_price ? (parseFloat(cost) * (1 + m / 100)).toFixed(2) : receiveForm.new_selling_price;
                                          setReceiveForm((f) => ({ ...f, unit_cost: cost, new_selling_price: price }));
                                        }}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3 cursor-pointer">
                                        <input type="checkbox" checked={receiveForm.update_selling_price} onChange={(e) => setReceiveForm(f => ({ ...f, update_selling_price: e.target.checked }))} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Update Selling Price?
                                      </label>
                                      {receiveForm.update_selling_price && (
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Margin %</label>
                                            <select name="margin" value={receiveForm.margin} onChange={(e) => {
                                              const margin = parseFloat(e.target.value) || 0;
                                              const cost = parseFloat(receiveForm.unit_cost) || 0;
                                              const price = (cost * (1 + margin / 100)).toFixed(2);
                                              setReceiveForm(f => ({ ...f, margin: e.target.value, new_selling_price: price }));
                                            }} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                              <option value="10">10%</option>
                                              <option value="20">20%</option>
                                              <option value="30">30%</option>
                                              <option value="50">50%</option>
                                              <option value="100">100%</option>
                                              <option value="0">Custom</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Selling Price (LKR) *</label>
                                            <input type="number" step="0.01" min="0" required={receiveForm.update_selling_price} value={receiveForm.new_selling_price}
                                              onChange={(e) => {
                                                setReceiveForm(f => ({ ...f, new_selling_price: e.target.value, margin: "0" }));
                                              }}
                                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 dark:bg-blue-900/30" />
                                          </div>
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
                                  <div className="pt-2">
                                    <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">{saving ? "Receiving…" : "Receive & Create Batch"}</button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {expandedTab === "adjust" && (
                              <div className="max-w-xl mx-auto">
                                <form onSubmit={handleStockAdjust} className="space-y-4">
                                  {detailsItem?.track_serial ? (
                                    <>
                                      <p className="text-xs text-gray-400 mb-4">Scan or type the serial number of the unit to adjust its status.</p>
                                      <div className="relative">
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Serial Number *</label>
                                        <input type="text" required value={unitAdjustSerialNumber} 
                                          onChange={(e) => {
                                            setUnitAdjustSerialNumber(e.target.value);
                                            setShowSerialDropdown(true);
                                          }}
                                          onFocus={() => setShowSerialDropdown(true)}
                                          onBlur={() => setTimeout(() => setShowSerialDropdown(false), 200)}
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                                          placeholder="e.g. SN-12345" />
                                        {showSerialDropdown && (
                                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {availableBatches.flatMap(b => b.units || [])
                                              .filter(u => u.serial_number.toLowerCase().includes(unitAdjustSerialNumber.toLowerCase()))
                                              .map(u => (
                                              <div 
                                                key={u.serial_number} 
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex justify-between items-center"
                                                onMouseDown={() => {
                                                   setUnitAdjustSerialNumber(u.serial_number);
                                                   setShowSerialDropdown(false);
                                                }}
                                              >
                                                <span className="text-gray-700 dark:text-gray-200">{u.serial_number}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'in_stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{u.status.replace('_', ' ')}</span>
                                              </div>
                                            ))}
                                            {availableBatches.flatMap(b => b.units || []).filter(u => u.serial_number.toLowerCase().includes(unitAdjustSerialNumber.toLowerCase())).length === 0 && (
                                              <div className="px-3 py-2 text-sm text-gray-400">No matching serial numbers</div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Status *</label>
                                        <select required value={unitAdjustStatus} onChange={(e) => setUnitAdjustStatus(e.target.value)}
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                          <option value="lost">Lost</option>
                                          <option value="returned">Returned to Supplier</option>
                                          <option value="damaged">Damaged</option>
                                          <option value="in_stock">In Stock (Recovered)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Reason (Optional)</label>
                                        <select value={unitAdjustReason} onChange={(e) => setUnitAdjustReason(e.target.value)}
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                          <option value="recount">Recount (System vs Physical mismatch)</option>
                                          <option value="damage">Damage (Broken in shop)</option>
                                          <option value="broken_by_technician">Broken by Technician (Mistake during repair)</option>
                                          <option value="loss">Loss (Missing or stolen)</option>
                                          <option value="return">Return (Sent back to supplier)</option>
                                          <option value="other">Other (Specify in note below)</option>
                                        </select>
                                      </div>
                                      {unitAdjustReason === "broken_by_technician" && (
                                        <div>
                                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select Technician *</label>
                                          <select required value={unitAdjustTechnician} onChange={(e) => setUnitAdjustTechnician(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="">-- Choose a Technician --</option>
                                            {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                          </select>
                                        </div>
                                      )}
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Note (Optional)</label>
                                        <textarea value={unitAdjustNote} onChange={(e) => setUnitAdjustNote(e.target.value)}
                                          placeholder="Provide details about the change..."
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]" />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs text-gray-400 mb-4">Use for recounts/shrinkage. Negative deducts oldest batches first.</p>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Reason for Adjustment *</label>
                                        <select required value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                          <option value="recount">Physical Recount Correction (System mismatch)</option>
                                          <option value="damaged">Damaged / Broken (Broken in shop)</option>
                                          <option value="broken_by_technician">Broken by Technician (Mistake during repair)</option>
                                          <option value="shrinkage">Lost / Missing (Stolen or missing)</option>
                                          <option value="supplier_return">Returned to Supplier (Sent back)</option>
                                          <option value="returned">Returned to Inventory (Tech returned)</option>
                                          <option value="other">Other (Specify in note below)</option>
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
                                      {adjustReason === "broken_by_technician" && (
                                        <div>
                                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select Technician *</label>
                                          <select required value={adjustTechnician} onChange={(e) => setAdjustTechnician(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="">-- Choose a Technician --</option>
                                            {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                          </select>
                                        </div>
                                      )}
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes (Optional)</label>
                                        <textarea value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholder="Explain the reason..." rows={2} />
                                      </div>
                                      {stockDelta && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">New quantity: <strong>{(detailsItem?.quantity ?? 0) + (parseInt(stockDelta, 10) || 0)}</strong></p>
                                      )}
                                    </>
                                  )}
                                  <div className="pt-2">
                                    <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">{saving ? "Updating…" : "Update Stock"}</button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {expandedTab === "logs" && (
                              <div>
                                {logsLoading ? (
                                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading logs...</p>
                                ) : adjustLogs.length === 0 ? (
                                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">No manual adjustments recorded for this item.</p>
                                ) : (
                                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {adjustLogs.map((log) => (
                                      <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
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
                                        {(() => {
                                          if (!log.note) return null;
                                          const { serial, text } = parseLogNote(log.note);
                                          return (
                                            <div className="mt-2">
                                              {serial !== "—" && <span className="inline-block bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono font-semibold mb-1">Serial: {serial}</span>}
                                              {text !== "—" && <p className="text-sm text-gray-600 dark:text-gray-300 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2 whitespace-pre-wrap">{text}</p>}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {expandedTab === "edit" && (
                              <div className="max-w-2xl mx-auto">
                                <form onSubmit={handleEdit} className="space-y-4">
                                  {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
                                  <CatalogFormFields form={form} handleChange={handleChange} setForm={setForm} showInitialStock={false} categories={categories} />
                                  <p className="text-xs text-gray-400">Stock &amp; cost are managed through purchase batches (use “Receive”).</p>
                                  <div className="flex gap-3 pt-1">
                                    <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">{saving ? "Saving…" : "Save Changes"}</button>
                                  </div>
                                </form>
                              </div>
                            )}

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
        </>
      ) : activeTab === "salvage" ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          {salvagedLoading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Loading salvage parts…</div>
          ) : salvagedParts.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">No available salvaged parts found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Part Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Condition</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Selling Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Extracted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {salvagedParts.map((part) => (
                  <tr key={part.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400 font-bold">{part.sku || "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{part.part_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        part.condition === "good" ? "bg-green-100 text-green-700" :
                        part.condition === "fair" ? "bg-yellow-100 text-yellow-700" :
                        part.condition === "poor" ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {part.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-400">
                      LKR {part.estimated_value ? Number(part.estimated_value).toLocaleString() : "0"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(part.extracted_date).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Serial</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-1/3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {globalLogs.map((log) => {
                  const { serial, text } = parseLogNote(log.note);
                  return (
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
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{serial !== "—" ? serial : ""}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 italic min-w-[200px] break-words whitespace-pre-wrap">{text !== "—" ? text : ""}</td>
                  </tr>
                  );
                })}
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


      <Modal open={!!labelPrompt} onClose={() => setLabelPrompt(null)} title={labelPrompt?.title || "Part Added"}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Batch <span className="font-mono font-semibold text-gray-800 dark:text-gray-100">{labelPrompt?.code}</span> was {labelPrompt?.action || "created"}.
            {labelPrompt?.serialNumbers?.length > 0 ? " Print individual QR labels for each serial number?" : " Print a QR label for this batch?"}
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setLabelPrompt(null)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Not now</button>
            <button type="button"
              onClick={() => { 
                const p = labelPrompt; 
                setLabelPrompt(null); 
                if (p) {
                   if (p.serialNumbers?.length > 0) {
                      const labels = p.serialNumbers.map(sn => ({ ...p, code: sn, qty: 1 }));
                      printLabels(labels);
                   } else {
                      printLabels([p]); 
                   }
                }
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors">Print Label{labelPrompt?.serialNumbers?.length > 0 ? "s" : ""}</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
