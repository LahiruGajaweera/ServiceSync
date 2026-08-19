import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import api from "../../services/api";

export default function PredictiveAnalytics() {
  const [faultTrends, setFaultTrends] = useState([]);
  const [deviceTrends, setDeviceTrends] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Colombo");
  const [selectedFaultCategory, setSelectedFaultCategory] = useState("");
  const [loading, setLoading] = useState(true);

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

  // Fetch Device Trends whenever selectedFaultCategory changes
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

  // Fetch Faults whenever selectedDevice or selectedLocation changes
  useEffect(() => {
    const fetchFaults = async () => {
      setLoading(true);
      try {
        const params = { location: selectedLocation };
        if (selectedDevice) {
            params.device_model = selectedDevice;
        }
        const { data } = await api.get("/analytics/predictions/faults", { params });
        setFaultTrends(data);
      } catch (e) {
        console.error("Failed to load fault trends", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFaults();
  }, [selectedDevice, selectedLocation]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col mb-4">
<<<<<<< Updated upstream
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">AI Predictions & Smart Alerts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Time-Series Forecasting using Scikit-Learn and ARIMA models</p>
      </div>

      {/* Smart Alerts Section */}
      <section>
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm uppercase tracking-wide">Smart Alerts: Inventory Demand</h3>
        {criticalInventory.length === 0 ? (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
            ✅ No critical stock shortages predicted for the upcoming week based on historical usage.
=======
        <h2 className="text-2xl font-bold text-gray-800">AI Predictions</h2>
        <p className="text-sm text-gray-500">Time-Series Forecasting using Scikit-Learn and ARIMA models</p>
      </div>

      {/* Trending Devices Chart */}
      <section className="bg-white rounded-xl shadow-sm p-6 border border-brand-100">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-800 text-lg uppercase tracking-wide flex items-center gap-2">
              <span className="text-brand-600">📈</span> Trending Devices Forecast
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              This chart highlights the top 10 smartphone models predicted to have the highest repair volume next month. 
              Use this insight to proactively stock up on parts for these specific models.
            </p>
>>>>>>> Stashed changes
          </div>
          <select
            value={selectedFaultCategory}
            onChange={(e) => setSelectedFaultCategory(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
        {/* Fault Trends */}
<<<<<<< Updated upstream
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm uppercase tracking-wide">Trending Faults (Next Month)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2">Fault Category</th>
                  <th className="pb-2">Current Avg/Mo</th>
                  <th className="pb-2">Predicted</th>
                  <th className="pb-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {faultTrends.length === 0 ? (
                  <tr><td colSpan="4" className="py-4 text-center text-gray-400">Not enough data to forecast</td></tr>
                ) : (
                  faultTrends.map((f, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3 capitalize font-medium">{f.fault_category.replace(/_/g, " ")}</td>
                      <td className="py-3">{f.current_avg}</td>
                      <td className="py-3 font-semibold">{f.forecasted}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          f.status === "increasing" ? "bg-red-100 text-red-700" :
                          f.status === "decreasing" ? "bg-green-100 text-green-700" :
                          "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                        }`}>
                          {f.trend_percentage > 0 ? "+" : ""}{f.trend_percentage}% {f.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Technician Score */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm uppercase tracking-wide">Technician Performance Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2">Technician</th>
                  <th className="pb-2">Jobs Completed</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {techScores.length === 0 ? (
                  <tr><td colSpan="4" className="py-4 text-center text-gray-400">Not enough data for scoring</td></tr>
                ) : (
                  techScores.map((t, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3 font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {idx === 0 && <span title="Top Performer">🥇</span>}
                        {idx === 1 && <span title="Runner Up">🥈</span>}
                        {t.name}
                      </td>
                      <td className="py-3">{t.total_jobs_completed}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${t.performance_score}%` }}></div>
=======
        <section className="bg-white rounded-xl shadow-sm p-6 w-full">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Trending Faults Forecast</h3>
              <p className="text-xs text-gray-500 mt-1">Expected repair volumes for the upcoming month based on recent patterns.</p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
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
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Models</option>
                {deviceTrends.map((d) => (
                  <option key={d.device_model} value={d.device_model}>{d.device_model}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-6">
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
                        <span className="capitalize font-semibold text-gray-800 text-sm">{f.fault_category.replace(/_/g, " ")}</span>
                        {f.weather_impacted && (
                          <span title="Expected rainfall increases the likelihood of this issue." className="px-2 py-0.5 w-max bg-blue-100 text-blue-800 text-[10px] uppercase font-bold rounded-full shadow-sm">
                            🌧️ Weather Alert
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-16 text-xs text-gray-500 text-right">Past Avg:</div>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex items-center">
                            <div className="h-full bg-gray-400 rounded-full" style={{ width: `${currentPct}%` }}></div>
>>>>>>> Stashed changes
                          </div>
                          <div className="w-8 text-xs font-medium text-gray-600">{Math.round(f.current_avg)}</div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="w-16 text-xs text-gray-800 font-medium text-right">Expected:</div>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex items-center">
                            <div 
                              className={`h-full rounded-full ${f.status === 'increasing' ? 'bg-red-500' : f.status === 'decreasing' ? 'bg-green-500' : 'bg-brand-500'}`} 
                              style={{ width: `${forecastPct}%` }}
                            ></div>
                          </div>
                          <div className="w-8 text-xs font-bold text-gray-800">{Math.round(f.forecasted)}</div>
                        </div>
                      </div>
                      
                      <div className="w-32 flex justify-end">
                        <span className={`px-2 py-1 flex items-center gap-1 w-max rounded-md text-xs font-bold ${
                          f.status === "increasing" ? "bg-red-50 text-red-700 border border-red-200" :
                          f.status === "decreasing" ? "bg-green-50 text-green-700 border border-green-200" :
                          "bg-gray-50 text-gray-600 border border-gray-200"
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
