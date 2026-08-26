import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

export default function SettingsManager() {
  const [activeTab, setActiveTab] = useState("general"); // "general" | "branding" | "financial" | "warranty"
  const [settings, setSettings] = useState({
    shop_name: "",
    shop_address: "",
    shop_phone: "",
    shop_email: "",
    tax_rate: "15.0",
    currency_symbol: "LKR",
    default_warranty_days: "30",
    invoice_footer_note: "",
    shop_logo_url: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
  const logoInputRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/settings");
      setSettings((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      showToast("error", err.response?.data?.detail || "Failed to load system settings.");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put("/settings", { settings });
      setSettings((prev) => ({ ...prev, ...res.data }));
      showToast("success", "System settings updated successfully!");
    } catch (err) {
      showToast("error", err.response?.data?.detail || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadingLogo(true);
    try {
      const res = await api.post("/settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSettings((prev) => ({ ...prev, shop_logo_url: res.data.logo_url }));
      showToast("success", "Shop logo uploaded successfully!");
    } catch (err) {
      showToast("error", err.response?.data?.detail || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const tabs = [
    { id: "general", label: "Shop Details", icon: "🏢" },
    { id: "branding", label: "Branding & Logo", icon: "🖼️" },
    { id: "financial", label: "Currency Settings", icon: "💰" },
    { id: "warranty", label: "Warranty & Repair", icon: "🛡️" },
  ];

  const inputCls =
    "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white transition";

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        Loading System Settings…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Toast alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 z-50 animate-bounce ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/80 border-red-300 text-red-800 dark:text-red-200"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            System Settings & Customizations
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Configure shop identity, invoice templates, currency symbol, and default repair warranties.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Saving Changes…</span>
            </>
          ) : (
            <>
              <span>💾 Save All Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
          {/* TAB 1: General Shop Details */}
          {activeTab === "general" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
                <span>🏢</span> Shop Identity & Contact
              </h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Shop / Business Name
                </label>
                <input
                  type="text"
                  name="shop_name"
                  value={settings.shop_name}
                  onChange={handleChange}
                  placeholder="e.g. ServiceSync Repair Center"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Shop Physical Address
                </label>
                <textarea
                  name="shop_address"
                  rows={3}
                  value={settings.shop_address}
                  onChange={handleChange}
                  placeholder="e.g. No. 123, Main Street, Colombo 03"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    name="shop_phone"
                    value={settings.shop_phone}
                    onChange={handleChange}
                    placeholder="e.g. 077 123 4567"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                    Support Email Address
                  </label>
                  <input
                    type="email"
                    name="shop_email"
                    value={settings.shop_email}
                    onChange={handleChange}
                    placeholder="e.g. info@servicesync.lk"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Branding & Logo */}
          {activeTab === "branding" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
                <span>🖼️</span> Logo & Invoice Customization
              </h2>

              {/* Logo Upload Box */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                  Shop Logo (Used on Receipts & Header)
                </label>
                <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                  <div className="w-20 h-20 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                    {settings.shop_logo_url ? (
                      <img
                        src={`http://localhost:8000${settings.shop_logo_url}`}
                        alt="Shop Logo"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-xs text-gray-400 font-semibold">No Logo</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm transition-colors"
                    >
                      {uploadingLogo ? "Uploading Logo…" : "Upload New Logo Image"}
                    </button>
                    <p className="text-xs text-gray-400">
                      Recommended format: PNG, JPG, or SVG (Max size 2MB).
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Invoice Footer Note / Thank You Message
                </label>
                <textarea
                  name="invoice_footer_note"
                  rows={3}
                  value={settings.invoice_footer_note}
                  onChange={handleChange}
                  placeholder="e.g. Thank you for choosing ServiceSync! All repairs include warranty."
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* TAB 3: Currency Settings */}
          {activeTab === "financial" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
                <span>💰</span> Currency Settings
              </h2>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Currency Symbol / Code
                </label>
                <input
                  type="text"
                  name="currency_symbol"
                  value={settings.currency_symbol}
                  onChange={handleChange}
                  placeholder="e.g. LKR or Rs."
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Displayed alongside prices across the system.</p>
              </div>
            </div>
          )}

          {/* TAB 4: Category Warranties */}
          {activeTab === "warranty" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700/60 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>🛡️</span> Category-Specific Warranty Periods
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Set default warranty days individually for each repair category (Display, Battery, Motherboard, etc.).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    let catMap = {};
                    try {
                      catMap = JSON.parse(settings.category_warranties || "{}");
                    } catch {
                      catMap = {};
                    }
                    const customName = prompt("Enter Custom Repair / Part Category Name (e.g. Camera Replacement):");
                    if (customName && customName.trim()) {
                      catMap[customName.trim()] = "30";
                      setSettings((prev) => ({ ...prev, category_warranties: JSON.stringify(catMap) }));
                    }
                  }}
                  className="px-3.5 py-2 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>➕ Add Custom Category</span>
                </button>
              </div>

              {/* Category Warranty Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const defaultCategories = [
                    { key: "Display & Touch", icon: "📱", desc: "Display & Touchscreen replacements" },
                    { key: "Battery Replacement", icon: "🔋", desc: "New battery installations" },
                    { key: "Charging Port", icon: "⚡", desc: "Charging port & sub-board repairs" },
                    { key: "Motherboard IC", icon: "🔬", desc: "Chip-level motherboard & micro-soldering" },
                    { key: "Software / Unlocking", icon: "💻", desc: "Flashing, OS & unlocking services" },
                    { key: "General Repairs", icon: "🛠️", desc: "Other miscellaneous phone repairs" },
                  ];

                  let catMap = {};
                  try {
                    catMap = JSON.parse(settings.category_warranties || "{}");
                  } catch {
                    catMap = {};
                  }

                  // Merge default categories with stored map
                  const allCategories = [...defaultCategories];
                  Object.keys(catMap).forEach((k) => {
                    if (!allCategories.some((c) => c.key === k)) {
                      allCategories.push({ key: k, icon: "🏷️", desc: "Custom repair category", isCustom: true });
                    }
                  });

                  return allCategories.map((cat) => {
                    const daysVal = catMap[cat.key] !== undefined ? catMap[cat.key] : (cat.key === "Software / Unlocking" ? "0" : cat.key === "Battery Replacement" ? "90" : "30");

                    const updateCategoryDays = (newDays) => {
                      const updated = { ...catMap, [cat.key]: String(newDays) };
                      setSettings((prev) => ({ ...prev, category_warranties: JSON.stringify(updated) }));
                    };

                    const removeCustomCategory = () => {
                      const updated = { ...catMap };
                      delete updated[cat.key];
                      setSettings((prev) => ({ ...prev, category_warranties: JSON.stringify(updated) }));
                    };

                    return (
                      <div
                        key={cat.key}
                        className="bg-gray-50 dark:bg-gray-700/40 rounded-2xl p-4 border border-gray-200 dark:border-gray-600/80 space-y-3 hover:shadow-md transition-all relative group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{cat.key}</h3>
                            <p className="text-[11px] text-gray-400">{cat.desc}</p>
                          </div>
                          {cat.isCustom && (
                            <button
                              type="button"
                              onClick={removeCustomCategory}
                              className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                              title="Delete Category"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Input & Quick Presets */}
                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex-1">
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min="0"
                                value={daysVal}
                                onChange={(e) => updateCategoryDays(e.target.value)}
                                className="w-full pl-3 pr-12 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <span className="absolute right-3 text-xs font-semibold text-gray-400 pointer-events-none">
                                Days
                              </span>
                            </div>
                          </div>

                          {/* Quick Days Preset Badges */}
                          <div className="flex gap-1">
                            {["0", "14", "30", "90"].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => updateCategoryDays(d)}
                                className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                                  daysVal === d
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                              >
                                {d === "0" ? "None" : `${d}d`}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Live Receipt Preview Card */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-xl border border-blue-900/50 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-blue-800/60 pb-3">
              <span className="text-xs uppercase font-bold tracking-widest text-blue-300">
                📄 Live Receipt Preview
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                Realtime
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                {settings.shop_logo_url ? (
                  <img
                    src={`http://localhost:8000${settings.shop_logo_url}`}
                    alt="Logo"
                    className="w-10 h-10 object-contain rounded bg-white p-0.5"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-blue-600/40 border border-blue-400/40 flex items-center justify-center font-bold text-white">
                    {settings.shop_name ? settings.shop_name.charAt(0) : "S"}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-white tracking-tight">
                    {settings.shop_name || "Shop Name"}
                  </h3>
                  <p className="text-blue-300 text-[11px]">{settings.shop_address || "Address"}</p>
                </div>
              </div>

              <div className="bg-blue-900/40 p-3 rounded-xl border border-blue-800/40 space-y-1">
                <div className="flex justify-between text-blue-200">
                  <span>Tel: {settings.shop_phone || "N/A"}</span>
                  <span>Email: {settings.shop_email || "N/A"}</span>
                </div>
              </div>

              {/* Category Warranties Badges in Receipt Preview */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-blue-800/50 space-y-2">
                <span className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <span>🛡️</span> Category Warranty Periods:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  {(() => {
                    let catMap = {};
                    try {
                      catMap = JSON.parse(settings.category_warranties || "{}");
                    } catch {
                      catMap = {};
                    }
                    const defaults = {
                      "Display & Touch": "30",
                      "Battery Replacement": "90",
                      "Charging Port": "14",
                      "Motherboard IC": "7",
                    };
                    const merged = { ...defaults, ...catMap };
                    return Object.entries(merged).map(([catName, days]) => (
                      <div
                        key={catName}
                        className="bg-emerald-950/40 border border-emerald-500/20 px-2 py-1 rounded flex justify-between items-center text-emerald-200"
                      >
                        <span className="truncate pr-1 font-medium">{catName}:</span>
                        <span className="font-bold text-emerald-300 shrink-0">
                          {days === "0" ? "No Warranty" : `${days} Days`}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="text-[11px] text-gray-300 italic bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
                "{settings.invoice_footer_note || "Footer message will appear here."}"
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-blue-900/60 text-[11px] text-blue-300 text-center">
            Changes saved here apply immediately across all modules.
          </div>
        </div>
      </form>
    </div>
  );
}
