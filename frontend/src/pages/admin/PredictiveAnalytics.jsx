import { useEffect, useState } from "react";
import api from "../../services/api";

function AlertCard({ title, value, type, message }) {
  const styles = {
    critical: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    ok: "bg-green-50 border-green-200 text-green-800",
  };
  const currentStyle = styles[type] || styles.ok;

  return (
    <div className={`p-4 rounded-xl border ${currentStyle} flex flex-col justify-between`}>
      <h4 className="font-bold">{title}</h4>
      <p className="text-sm mt-1">{message}</p>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-2xl font-black">{value}</span>
      </div>
    </div>
  );
}

export default function PredictiveAnalytics() {
  const [inventoryForecast, setInventoryForecast] = useState([]);
  const [faultTrends, setFaultTrends] = useState([]);
  const [techScores, setTechScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, faultsRes, techRes] = await Promise.all([
          api.get("/analytics/predictions/inventory"),
          api.get("/analytics/predictions/faults"),
          api.get("/analytics/technician-performance"),
        ]);
        setInventoryForecast(invRes.data);
        setFaultTrends(faultsRes.data);
        setTechScores(techRes.data);
      } catch (e) {
        console.error("Failed to load predictions", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm animate-pulse">Running AI Forecasts...</div>
      </div>
    );
  }

  const criticalInventory = inventoryForecast.filter(i => i.status === "critical" || i.status === "warning");

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col mb-4">
        <h2 className="text-2xl font-bold text-gray-800">AI Predictions & Smart Alerts</h2>
        <p className="text-sm text-gray-500">Time-Series Forecasting using Scikit-Learn and ARIMA models</p>
      </div>

      {/* Smart Alerts Section */}
      <section>
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Smart Alerts: Inventory Demand</h3>
        {criticalInventory.length === 0 ? (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
            ✅ No critical stock shortages predicted for the upcoming week based on historical usage.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {criticalInventory.map((inv, idx) => (
              <AlertCard
                key={idx}
                type={inv.status}
                title={inv.part_name}
                value={`${inv.restock_recommended} needed`}
                message={`Predicted demand: ${inv.predicted_demand}. Current stock: ${inv.current_stock}.`}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fault Trends */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Trending Faults (Next Month)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 border-b">
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
                          "bg-gray-100 text-gray-700"
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
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Technician Performance Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 border-b">
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
                      <td className="py-3 font-medium text-gray-800 flex items-center gap-2">
                        {idx === 0 && <span title="Top Performer">🥇</span>}
                        {idx === 1 && <span title="Runner Up">🥈</span>}
                        {t.name}
                      </td>
                      <td className="py-3">{t.total_jobs_completed}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${t.performance_score}%` }}></div>
                          </div>
                          <span className="font-bold">{t.performance_score}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          t.rating === "Excellent" ? "bg-green-100 text-green-800" :
                          t.rating === "Good" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                        }`}>
                          {t.rating}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
