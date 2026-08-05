import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function StatCard({ label, value, sub, color, subClassName = "text-gray-400" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${subClassName}`}>{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
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
  const [currentLowStockIdx, setCurrentLowStockIdx] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [now, setNow] = useState(new Date());

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
      const [activeRes, pickupRes, lowStockRes, recentRes, analyticsRes] = await Promise.allSettled([
        api.get("/jobs/", { params: { status: "in_progress" } }),
        api.get("/jobs/", { params: { status: "ready_for_pickup" } }),
        api.get("/inventory/low-stock"),
        api.get("/jobs/"),
        api.get("/analytics/summary"),
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
        setRecentJobs(recentRes.value.data.slice(0, 6));
      }
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const statusBadge = (s) => {
    const map = {
      pending:          "bg-gray-100 text-gray-600",
      in_progress:      "bg-blue-100 text-blue-700",
      completed:        "bg-purple-100 text-purple-700",
      ready_for_pickup: "bg-amber-100 text-amber-700",
      delivered:        "bg-green-100 text-green-700",
      unclaimed:        "bg-red-100 text-red-700",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of system operations and statistics</p>
      </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Jobs */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Recent Jobs</h3>
            <Link to="/admin/jobs" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>

          {loadingJobs ? (
            <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl mx-2 my-2">
              <p className="font-medium text-gray-500 text-sm">No jobs registered yet</p>
              <Link to="/admin/jobs?new=1" className="mt-3 text-xs text-blue-600 hover:underline">Register first job →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Job ID", "Customer", "Device", "Status"].map((h) => (
                    <th key={h} className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentJobs.map((job) => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/jobs?jobId=${job.id}`)}
                  >
                    <td className="py-2.5 font-mono text-xs text-blue-600 font-semibold">{job.job_id}</td>
                    <td className="py-2.5 text-gray-700">{job.customer_name}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{job.device_brand} {job.device_model}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(job.status)}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {[
              { label: "Register New Job",   to: "/admin/jobs?new=1" },
              { label: "Add Inventory Part", to: "/admin/inventory" },
              { label: "Add Technician",     to: "/admin/technicians" },
              { label: "Customer Registry",  to: "/admin/customers" },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="w-full flex items-center px-4 py-3 rounded-lg bg-brand-50 hover:bg-brand-500
                           text-brand-700 hover:text-white text-left transition-all shadow-sm hover:shadow-md text-sm group"
              >
                <span className="flex-1 font-medium">{action.label}</span>
                <span className="opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-xs">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
