import { useEffect, useState, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import api from "../../services/api";

function CustomSearchSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  return (
    <div className="relative" ref={wrapRef}>
      <button 
        type="button" 
        onClick={() => { setOpen(!open); setQuery(""); }}
        className="flex items-center justify-between px-3 py-1.5 w-32 md:w-40 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className="truncate">{value || placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input 
              type="text"
              autoFocus
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto text-sm">
            <li 
              onClick={() => { onChange(""); setOpen(false); }}
              className={`px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-gray-700 ${!value ? "font-bold text-brand-600" : "text-gray-700 dark:text-gray-200"}`}
            >
              {placeholder}
            </li>
            {filtered.map(opt => (
              <li 
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-gray-700 ${value === opt ? "font-bold text-brand-600" : "text-gray-700 dark:text-gray-200"}`}
              >
                {opt}
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-gray-400">No results</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PredictiveAnalytics() {
  const [faultTrends, setFaultTrends] = useState([]);
  const [deviceTrends, setDeviceTrends] = useState([]);
  const [criticalInventory, setCriticalInventory] = useState([]);
  const [techScores, setTechScores] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Colombo");
  const [selectedFaultCategory, setSelectedFaultCategory] = useState("");
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const faultCategories = [
    { value: "screen", label: "Screen" },
    { value: "battery", label: "Battery" },
    { value: "charging_port", label: "Charging Port" },
    { value: "camera", label: "Camera" },
    { value: "speaker", label: "Speaker" },
    { value: "software", label: "Software" },
    { value: "water_damage", label: "Water Damage" },
    { value: "other", label: "Other" }
  ];

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const { data } = await api.get("/brands/");
        setBrands(data.map(b => b.name));
      } catch (e) {
        console.error("Failed to load brands", e);
      }
    };
    fetchBrands();
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedBrand) {
        setModels([]);
        return;
      }
      try {
        const { data } = await api.get("/models/", { params: { brand: selectedBrand } });
        setModels(data.map(m => m.name));
      } catch (e) {
        console.error("Failed to load models", e);
      }
    };
    fetchModels();
  }, [selectedBrand]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const params = selectedFaultCategory ? { fault_category: selectedFaultCategory } : {};
        const { data } = await api.get("/analytics/predictions/devices", { params });
        setDeviceTrends(data);
      } catch (e) {
        console.error("Failed to load device trends", e);
      }
    };
    fetchDevices();
  }, [selectedFaultCategory]);

  useEffect(() => {
    const fetchAll = async () => {
      if (!loading) setIsUpdating(true);
      try {
        const params = { location: selectedLocation };
        if (selectedBrand) params.device_brand = selectedBrand;
        if (selectedDevice) params.device_model = selectedDevice;

        const [faultsRes, invRes, techRes] = await Promise.all([
          api.get("/analytics/predictions/faults", { params }),
          api.get("/analytics/predictions/inventory").catch(() => ({ data: [] })),
          api.get("/analytics/leaderboard").catch(() => ({ data: [] }))
        ]);
        
        setFaultTrends(faultsRes.data);
        if (invRes.data) {
          setCriticalInventory(invRes.data.filter(i => i.status === "critical"));
        }
        if (techRes.data) {
          setTechScores(techRes.data);
        }
      } catch (e) {
        console.error("Failed to load analytics data", e);
      } finally {
        setLoading(false);
        setIsUpdating(false);
      }
    };
    fetchAll();
  }, [selectedBrand, selectedDevice, selectedLocation]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">AI Predictions & Smart Alerts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Time-Series Forecasting using Scikit-Learn and ARIMA models</p>
      </div>

      <section>
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm uppercase tracking-wide">Smart Alerts: Inventory Demand</h3>
        {criticalInventory.length === 0 ? (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
            ✅ No critical stock shortages predicted for the upcoming week based on historical usage.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {criticalInventory.map((inv, idx) => (
              <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-red-800">Critical Shortage Predicted: {inv.part_name}</h4>
                  <p className="text-sm text-red-600">
                    Current Stock: {inv.current_stock} | Predicted Demand: {inv.predicted_demand} | 
                    Restock Recommendation: <span className="font-bold">+{inv.restock_recommended} units</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-brand-100 dark:border-gray-700">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg uppercase tracking-wide flex items-center gap-2">
              <span className="text-brand-600">📈</span> Trending Devices Forecast
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              This chart highlights the top 10 smartphone models predicted to have the highest repair volume next month. 
              Use this insight to proactively stock up on parts for these specific models.
            </p>
          </div>
          <select
            value={selectedFaultCategory}
            onChange={(e) => setSelectedFaultCategory(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Repair Types</option>
            {faultCategories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        
        {deviceTrends.length === 0 ? (
          <div className="py-10 text-center text-gray-400">Not enough data to forecast device trends</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceTrends.slice(0, 10).map(d => ({ ...d, forecasted: Math.round(d.forecasted) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="device_model" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="forecasted" name="Expected Repairs" radius={[6, 6, 0, 0]}>
                  {deviceTrends.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-8">
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 w-full">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">Trending Faults Forecast</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Expected repair volumes for the upcoming month based on recent patterns.</p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                title="Weather Location"
              >
                <option value="Colombo">Colombo</option>
                <option value="Kandy">Kandy</option>
                <option value="Galle">Galle</option>
                <option value="Jaffna">Jaffna</option>
                <option value="Gampaha">Gampaha</option>
                <option value="Kurunegala">Kurunegala</option>
                <option value="Anuradhapura">Anuradhapura</option>
              </select>
              <div className="flex gap-2">
                <CustomSearchSelect 
                  value={selectedBrand}
                  onChange={(val) => {
                    setSelectedBrand(val);
                    setSelectedDevice("");
                  }}
                  options={brands}
                  placeholder="All Brands"
                />

                <CustomSearchSelect 
                  value={selectedDevice}
                  onChange={(val) => setSelectedDevice(val)}
                  options={models}
                  placeholder="All Models"
                />
              </div>
            </div>
          </div>
          
          <div className={`mt-6 flex flex-col gap-6 transition-opacity duration-300 ${isUpdating ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            {loading ? (
              <div className="py-10 text-center text-gray-400 animate-pulse">Running AI Forecasts...</div>
            ) : faultTrends.length === 0 ? (
              <div className="py-4 text-center text-gray-400">Not enough data to forecast</div>
            ) : (
              (() => {
                const maxVal = Math.max(...faultTrends.map(f => Math.max(f.current_avg, f.forecasted)), 1);
                
                return faultTrends.map((f, idx) => {
                  const currentPct = (f.current_avg / maxVal) * 100;
                  const forecastPct = (f.forecasted / maxVal) * 100;
                  
                  return (
                    <div key={idx} className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="w-full md:w-32 flex-shrink-0 flex flex-col gap-1">
                        <span className="capitalize font-semibold text-gray-800 dark:text-gray-100 text-sm">{f.fault_category.replace(/_/g, " ")}</span>
                        {f.weather_impacted && (
                          <span title="Expected rainfall increases the likelihood of this issue." className="px-2 py-0.5 w-max bg-blue-100 text-blue-800 text-[10px] uppercase font-bold rounded-full shadow-sm">
                            🌧️ Weather Alert
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-16 text-xs text-gray-500 dark:text-gray-400 text-right">Past Avg:</div>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
                            <div className="h-full bg-gray-400 dark:bg-gray-500 rounded-full" style={{ width: `${currentPct}%` }}></div>
                          </div>
                          <div className="w-8 text-xs font-medium text-gray-600 dark:text-gray-300">{Math.round(f.current_avg)}</div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="w-16 text-xs text-gray-800 dark:text-gray-200 font-medium text-right">Expected:</div>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
                            <div 
                              className={`h-full rounded-full ${f.status === 'increasing' ? 'bg-red-500' : f.status === 'decreasing' ? 'bg-green-500' : 'bg-brand-500'}`} 
                              style={{ width: `${forecastPct}%` }}
                            ></div>
                          </div>
                          <div className="w-8 text-xs font-bold text-gray-800 dark:text-gray-100">{Math.round(f.forecasted)}</div>
                        </div>
                      </div>
                      
                      <div className="w-32 flex justify-end">
                        <span className={`px-2 py-1 flex items-center gap-1 w-max rounded-md text-xs font-bold ${
                          f.status === "increasing" ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400" :
                          f.status === "decreasing" ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400" :
                          "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                        }`}>
                          {f.status === "increasing" && <><span className="text-red-500">⬆</span> Increasing</>}
                          {f.status === "decreasing" && <><span className="text-green-500">⬇</span> Decreasing</>}
                          {f.status === "stable" && <><span className="text-gray-400">➡</span> Stable</>}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </section>


      </div>
    </div>
  );
}
