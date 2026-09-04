import { useEffect, useRef, useState } from "react";
import PhoneInput from "../../components/PhoneInput";
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
  const [saveStatus, setSaveStatus] = useState("idle"); // idle, saving, saved
  const initialLoad = useRef(true);
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

  useEffect(() => {
    if (initialLoad.current) {
      if (!loading && settings.shop_name) {
        initialLoad.current = false;
      }
      return;
    }

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await api.put("/settings", { settings });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (err) {
        showToast("error", err.response?.data?.detail || "Failed to auto-save settings.");
        setSaveStatus("idle");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [settings, loading]);

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
    { id: "general", label: "Shop Details" },
    { id: "branding", label: "Branding & Logo" },
    { id: "financial", label: "Currency Settings" },
    { id: "warranty", label: "Warranty & Repair" },
    { id: "promotions", label: "Offers & Promotions" },
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
        <div className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
          {saveStatus === "saving" && <><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span><span className="text-blue-600 dark:text-blue-400">Saving changes...</span></>}
          {saveStatus === "saved" && <><span className="text-green-500">✓</span><span className="text-green-600 dark:text-green-400">Saved</span></>}
          {saveStatus === "idle" && <span className="text-gray-500 dark:text-gray-400">Changes auto-save instantly</span>}
        </div>
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
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Form Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                  <PhoneInput
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

          {/* TAB 5: Promotions */}
          {activeTab === "promotions" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🏷️</span> Seasonal Offers & Discounts
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure automated discounts per repair category. Margin protection ensures you never lose money on parts.
                </p>
              </div>

              {(() => {
                let promo = { active: false, min_margin_percent: 10, offers: {} };
                try {
                  if (settings.promotional_offers) {
                    promo = JSON.parse(settings.promotional_offers);
                  }
                } catch (e) {}

                const updatePromo = (newPromo) => {
                  setSettings(prev => ({ ...prev, promotional_offers: JSON.stringify(newPromo) }));
                };

                const faultCategories = [
                  "screen", "battery", "charging_port", "camera", "speaker", "software", "water_damage", "other"
                ];

                return (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                      <div className="flex-1">
                        <label className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-100 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={promo.active}
                            onChange={(e) => updatePromo({ ...promo, active: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          Enable Automated Promotional Offers
                        </label>
                        <p className="text-xs text-blue-700 dark:text-blue-300 ml-6 mt-1">If unchecked, no automated discounts will be applied to invoices.</p>
                      </div>
                    </div>

                    <div className={`space-y-5 transition-opacity duration-300 ${!promo.active ? 'opacity-40 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div>
                          <div className="font-bold text-sm text-gray-900 dark:text-white">Margin Protection</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Minimum profit margin percentage to keep on parts.</div>
                        </div>
                        <div className="mt-3 sm:mt-0 flex items-center gap-2">
                          <div className="relative inline-flex items-center">
                            <input type="number" min="0" max="100" value={promo.min_margin_percent || 0} onChange={(e) => updatePromo({ ...promo, min_margin_percent: Number(e.target.value) })} className="w-24 pl-3 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-right focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                            <span className="absolute right-3 text-gray-400 font-bold">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm">
                        <div>
                          <div className="font-bold text-sm text-blue-900 dark:text-blue-100">Bulk Apply to All Categories</div>
                          <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Set the exact same discount for every repair category at once.</div>
                        </div>
                        <div className="mt-3 sm:mt-0 flex gap-2 items-center flex-wrap sm:flex-nowrap">
                          <select id="bulkType" className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="none">No Discount</option>
                            <option value="fixed">Fixed Off</option>
                            <option value="percentage">% Off</option>
                          </select>
                          <input id="bulkValue" type="number" min="0" placeholder="Value" className="w-24 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-right bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <button type="button" onClick={() => {
                             const type = document.getElementById('bulkType').value;
                             const val = Number(document.getElementById('bulkValue').value);
                             const newOffers = {};
                             if (type !== "none") {
                               faultCategories.forEach(cat => { newOffers[cat] = { type, value: val }; });
                             }
                             updatePromo({ ...promo, offers: newOffers });
                           }} className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm whitespace-nowrap transition-colors">
                            Apply All
                          </button>
                        </div>
                      </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {faultCategories.map(cat => {
                        const offer = promo.offers[cat] || { type: "none", value: 0 };
                        
                        const handleOfferChange = (key, val) => {
                          const newOffers = { ...promo.offers };
                          if (val === "none") {
                            delete newOffers[cat];
                          } else {
                            newOffers[cat] = { ...offer, [key]: val };
                            // Reset value when changing types if needed
                            if (key === "type") newOffers[cat].value = 0; 
                          }
                          updatePromo({ ...promo, offers: newOffers });
                        };

                        return (
                          <div key={cat} className="flex flex-col xl:flex-row xl:items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl gap-3 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                             <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 capitalize">{cat.replace("_", " ")}</div>
                             <div className="flex gap-2 w-full xl:w-auto">
                               <select 
                                 value={offer.type} 
                                 onChange={(e) => handleOfferChange("type", e.target.value)}
                                 className="flex-1 xl:flex-none text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                               >
                                 <option value="none">No Discount</option>
                                 <option value="fixed">Fixed Off</option>
                                 <option value="percentage">% Off</option>
                               </select>
                               {offer.type !== "none" && (
                                 <input 
                                   type="number" min="0" value={offer.value} onChange={(e) => handleOfferChange("value", Number(e.target.value))}
                                   className="w-24 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-right bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                   placeholder="Value"
                                 />
                               )}
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Live Thermal Receipt Preview Card */}
        <div className="bg-gray-100 dark:bg-gray-900/60 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-white text-black font-sans shadow-lg p-5 border-t-8 border-gray-800 rounded-b-md relative">
            
            {/* Mock zig-zag bottom for receipt effect */}
            <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[length:10px_10px] bg-repeat-x" 
                 style={{ backgroundImage: "linear-gradient(-45deg, transparent 75%, white 75%), linear-gradient(45deg, transparent 75%, white 75%)", backgroundPosition: "0 0, 0 0" }}>
            </div>

            <div className="text-center">
              {settings.shop_logo_url && (
                <img
                  src={`http://localhost:8000${settings.shop_logo_url}`}
                  alt="Logo"
                  className="w-14 h-14 mx-auto object-contain mb-3 grayscale"
                />
              )}
              <div className="font-extrabold text-xl leading-tight tracking-tight">{settings.shop_name || "Shop Name"}</div>
              <div className="text-xs text-gray-500 mt-1">{settings.shop_address || "Shop Address"}</div>
              <div className="text-xs text-gray-500">{settings.shop_phone || "Contact Number"}</div>
            </div>

            <hr className="border-t border-dashed border-gray-400 my-4" />

            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Repair Job / Receipt</div>
              <div className="font-bold text-xl tracking-widest my-0.5 text-gray-400">[JOB ID]</div>
              <div className="text-[10px] text-gray-400">[DATE & TIME]</div>
            </div>

            <hr className="border-t border-dashed border-gray-400 my-4" />

            <table className="w-full text-xs text-gray-400">
              <tbody>
                <tr><td className="py-0.5 w-2/5">Customer</td><td className="py-0.5 font-bold text-right">[Customer Name]</td></tr>
                <tr><td className="py-0.5">Phone</td><td className="py-0.5 font-bold text-right">[Phone Number]</td></tr>
                <tr><td className="py-0.5">Device</td><td className="py-0.5 font-bold text-right">[Device Brand & Model]</td></tr>
                <tr><td className="py-0.5">Fault</td><td className="py-0.5 font-bold text-right">[Fault Category]</td></tr>
                <tr><td className="py-0.5">Est. Cost</td><td className="py-0.5 font-bold text-right">{settings.currency_symbol || "LKR"} [Amount]</td></tr>
              </tbody>
            </table>

            <hr className="border-t border-dashed border-gray-400 my-4" />
            
            <div className="text-center">
              <div className="w-24 h-24 mx-auto border-4 border-black p-1 flex items-center justify-center mb-1">
                <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-full h-full bg-black p-0.5">
                  <div className="bg-white"></div><div className="bg-white"></div><div className="bg-white"></div>
                  <div className="bg-white"></div><div className="bg-black"></div><div className="bg-white"></div>
                  <div className="bg-white"></div><div className="bg-white"></div><div className="bg-white"></div>
                </div>
              </div>
              <div className="text-[10px] font-bold text-blue-600 mt-1">Scan to track your repair</div>
            </div>

            <hr className="border-t border-dashed border-gray-400 my-4" />

            <div className="text-center text-[11px] text-gray-600 mt-4 leading-snug">
              "{settings.invoice_footer_note || "Footer message will appear here."}"
            </div>
            
            <div className="text-center text-[9px] text-gray-400 mt-4 pt-3 font-semibold">
              <span className="text-gray-500">Policy:</span> Devices not collected within 90 days will be considered abandoned.
            </div>
          </div>
          
          <div className="mt-8 text-[11px] font-medium text-gray-500 dark:text-gray-400 text-center flex items-center gap-1.5">
            <span>🖨️</span> WYSIWYG 80mm POS Thermal Receipt format
          </div>
        </div>
      </div>
    </div>
  );
}
