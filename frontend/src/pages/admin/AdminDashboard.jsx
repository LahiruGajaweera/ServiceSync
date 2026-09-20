import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import AlertCard from "../../components/AlertCard";
import AutoSlidingAlerts from "../../components/AutoSlidingAlerts";

function StatCard({ label, value, sub, color, subClassName = "text-gray-400" }) {
  return (
    <div className="glass-panel rounded-2xl px-6 py-5 flex flex-col justify-center min-h-[110px] hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-300">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-4xl font-extrabold tracking-tight ${color} drop-shadow-sm`}>{value}</span>
      </div>
      {sub && <p className={`text-xs mt-2 ${subClassName} line-clamp-1 opacity-90`} title={typeof sub === 'string' ? sub : ''}>{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="glass-panel bg-white/90 dark:bg-gray-800/90 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-up border border-white/50 dark:border-gray-700/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700/50">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "pending",          label: "Pending" },
  { value: "in_progress",      label: "In Progress" },
  { value: "completed",        label: "Completed" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "delivered",        label: "Delivered" },
  { value: "unclaimed",        label: "Unclaimed" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ activeJobs: "…", pendingPickup: "…", lowStock: "…", revenue: "…" });
  const [recentJobs, setRecentJobs] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [currentLowStockIdx, setCurrentLowStockIdx] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [now, setNow] = useState(new Date());
  const [inventoryForecast, setInventoryForecast] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotation for low stock
  useEffect(() => {
    if (lowStockItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentLowStockIdx((prev) => (prev + 1) % lowStockItems.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [lowStockItems]);

  const fetchStats = async () => {
    try {
      const [activeRes, pickupRes, lowStockRes, recentRes, analyticsRes, tasksRes] = await Promise.allSettled([
        api.get("/jobs/", { params: { status: "in_progress" } }),
        api.get("/jobs/", { params: { status: "ready_for_pickup" } }),
        api.get("/inventory/low-stock"),
        api.get("/jobs/"),
        api.get("/analytics/summary"),
        api.get("/tasks/")
      ]);

      let lsCount = "—";
      if (lowStockRes.status === "fulfilled") {
        lsCount = lowStockRes.value.data.length;
        setLowStockItems(lowStockRes.value.data);
      }

      setStats({
        activeJobs:    activeRes.status   === "fulfilled" ? activeRes.value.data.length   : "—",
        pendingPickup: pickupRes.status   === "fulfilled" ? pickupRes.value.data.length   : "—",
        lowStock:      lsCount,
        revenue:       analyticsRes.status === "fulfilled" && analyticsRes.value.data.revenue ? 
                       `LKR ${Number(analyticsRes.value.data.revenue.month_paid).toLocaleString()}` : "LKR 0"
      });

      if (recentRes.status === "fulfilled") {
        const targetStatuses = ["completed", "ready_for_pickup"];
        const filtered = recentRes.value.data.filter(j => targetStatuses.includes(j.status));
        setRecentJobs(filtered.slice(0, 6));
      }
      if (tasksRes && tasksRes.status === "fulfilled") {
        setAdminTasks(tasksRes.value.data);
      }
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => { 
    fetchStats(); 
    const interval = setInterval(fetchStats, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);
  
  const handleCompleteTask = async (taskId) => {
    try {
        await api.patch(`/tasks/${taskId}/complete`);
        setAdminTasks(prev => prev.filter(t => t.id !== taskId));
        if (adminTasks.length <= 1) setShowTasksModal(false);
    } catch (err) {
        console.error("Failed to complete task:", err);
    }
  };

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const { data } = await api.get("/analytics/predictions/inventory");
        setInventoryForecast(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchForecast();
  }, []);

  const statusBadge = (s) => {
    const map = {
      pending:          "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
      in_progress:      "bg-blue-100 text-blue-700",
      completed:        "bg-purple-100 text-purple-700",
      ready_for_pickup: "bg-amber-100 text-amber-700",
      delivered:        "bg-green-100 text-green-700",
      unclaimed:        "bg-red-100 text-red-700",
    };
    return map[s] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview of system operations and statistics</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {[
            { label: "Register New Job",   to: "/admin/jobs?new=1" },
            { label: "Add Inventory Part", to: "/admin/inventory" },
            { label: "Add Technician",     to: "/admin/technicians" },
            { label: "Customer Registry",  to: "/admin/customers" },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
      
      {/* Admin Pending Call Tasks Alert - Compact Banner */}
      {adminTasks.length > 0 && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center">
                  <span className="text-2xl mr-3">🚨</span>
                  <div>
                      <h3 className="font-bold text-red-800 text-base">Urgent Action Required: {adminTasks.length} Pending Customer Calls</h3>
                      <p className="text-red-600 text-sm mt-0.5">Contact these customers before their devices are automatically salvaged.</p>
                  </div>
              </div>
              <button 
                onClick={() => setShowTasksModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
              >
                  Review Tasks
              </button>
          </div>
      )}

      {/* Admin Tasks Modal */}
      <Modal open={showTasksModal} onClose={() => setShowTasksModal(false)} title="Pending Customer Calls">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {adminTasks.map(task => (
                  <div key={task.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                      <div>
                          <p className="font-mono text-xs font-bold text-red-600 mb-1">{task.job_public_id}</p>
                          <p className="text-gray-800 dark:text-gray-100 font-medium text-sm">{task.message}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Device: {task.device}</p>
                      </div>
                      <button 
                        onClick={() => handleCompleteTask(task.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 w-full py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                          Mark as Called ✓
                      </button>
                  </div>
              ))}
              {adminTasks.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-4">No pending calls.</p>
              )}
          </div>
      </Modal>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard label="Active Jobs"       value={stats.activeJobs}    sub="Currently under repair"        color="text-blue-600" />
        <StatCard label="Pending Pickup"    value={stats.pendingPickup} sub="Repairs ready to collect"      color="text-amber-600" />
        <StatCard 
          label="Low Stock Alerts"  
          value={stats.lowStock}      
          sub={
            lowStockItems.length > 0 ? (
              <span key={currentLowStockIdx} className="inline-block animate-fade-in text-red-500 font-medium">
                ⚠️ {lowStockItems[currentLowStockIdx].name} ({lowStockItems[currentLowStockIdx].quantity} left)
              </span>
            ) : "Stock levels healthy"
          } 
          color="text-red-600" 
          subClassName={lowStockItems.length > 0 ? "" : "text-gray-400"}
        />
        <StatCard label="Revenue (Month)"   value={stats.revenue}       sub="Current month paid total"      color="text-green-600" />
      </div>

      {inventoryForecast && inventoryForecast.filter(i => i.status === "critical" || i.status === "warning").length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Smart Alerts: Inventory Demand Prediction</h3>
          <AutoSlidingAlerts alerts={inventoryForecast.filter(i => i.status === "critical" || i.status === "warning")} />
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Recent Jobs */}
        <div className="glass-panel rounded-2xl p-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200">Ready & Completed Jobs</h3>
            <Link to="/admin/jobs" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>

          {loadingJobs ? (
            <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mx-2 my-2">
              <p className="font-medium text-gray-500 dark:text-gray-400 text-sm">No ready or completed jobs</p>
              <Link to="/admin/jobs?new=1" className="mt-3 text-xs text-blue-600 hover:underline">Register first job</Link>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left table-fixed min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-2 px-4 text-xs font-semibold text-gray-400 uppercase w-1/4">Job ID</th>
                    <th className="pb-2 px-4 text-xs font-semibold text-gray-400 uppercase w-1/4">Customer</th>
                    <th className="pb-2 px-4 text-xs font-semibold text-gray-400 uppercase w-1/4">Device</th>
                    <th className="pb-2 px-4 text-xs font-semibold text-gray-400 uppercase w-1/4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {recentJobs.map((job) => (
                    <tr 
                      key={job.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/jobs?jobId=${job.id}`)}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-blue-600 font-semibold">{job.job_id}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-200">{job.customer_name}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">{job.device_brand} {job.device_model}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(job.status)}`}>
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
