import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import api from "../../services/api";

const STATUS_COLORS = {
  pending:          "#94a3b8",
  in_progress:      "#3b82f6",
  completed:        "#a855f7",
  ready_for_pickup: "#f59e0b",
  delivered:        "#22c55e",
  unclaimed:        "#ef4444",
};

const FAULT_COLORS = ["#3b82f6","#a855f7","#f59e0b","#22c55e","#ef4444","#06b6d4","#f97316","#64748b"];

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border-l-4 ${accent}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

const fmtLKR = (n) =>
  n == null ? "—" : `LKR ${Number(n).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab]   = useState("overview");
  const [summary, setSummary]       = useState(null);
  const [jobsTrend, setJobsTrend]   = useState([]);
  const [revTrend, setRevTrend]     = useState([]);
  const [techStats, setTechStats]   = useState([]);
  const [techLeaderboard, setTechLeaderboard] = useState([]);
  const [faultDist, setFaultDist]   = useState([]);
  const [faultFilters, setFaultFilters] = useState({
    days: "all",
    brand: "all",
    model: "",
    status: "all",
  });
  const [statusDist, setStatusDist] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, jobsRes, revRes, techRes, statusRes, leaderRes] = await Promise.all([
          api.get("/analytics/summary"),
          api.get("/analytics/jobs-trend", { params: { days: 30 } }),
          api.get("/analytics/revenue-trend", { params: { months: 6 } }),
          api.get("/analytics/technician-stats"),
          api.get("/analytics/status-distribution"),
          api.get("/analytics/technician-performance"),
        ]);
        setSummary(sumRes.data);
        setJobsTrend(jobsRes.data);
        setRevTrend(revRes.data);
        setTechStats(techRes.data);
        setStatusDist(statusRes.data);
        setTechLeaderboard(leaderRes.data);
      } catch (e) {
        setError("Failed to load analytics. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadFaults = async () => {
      try {
        const params = {};
        if (faultFilters.days !== "all") params.days = faultFilters.days;
        if (faultFilters.brand !== "all") params.brand = faultFilters.brand;
        if (faultFilters.model.trim() !== "") params.model = faultFilters.model.trim();
        if (faultFilters.status !== "all") params.status = faultFilters.status;

        const res = await api.get("/analytics/fault-distribution", { params });
        setFaultDist(res.data);
      } catch (e) {
        console.error("Failed to load fault distribution", e);
      }
    };
    loadFaults();
  }, [faultFilters]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm animate-pulse">Loading analytics…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  const j = summary?.jobs ?? {};
  const r = summary?.revenue ?? {};

  const combinedTechs = [...techStats].map(t => {
    const leaderData = techLeaderboard.find(l => l.technician_id === t.technician_id);
    return {
      ...t,
      score: leaderData?.performance_score ?? null,
      rating: leaderData?.rating ?? null,
      specialty: leaderData?.top_specialty ?? null
    };
  }).sort((a, b) => {
    if (a.score !== null && b.score !== null) return b.score - a.score;
    if (a.score !== null) return -1;
    if (b.score !== null) return 1;
    return b.total - a.total;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Analytics Dashboard</h2>
        <span className="text-xs text-gray-400">Live data from ServiceSync</span>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Business Overview
        </button>
        <button
          onClick={() => setActiveTab("job-analysis")}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "job-analysis"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Job Analysis
        </button>
        <button
          onClick={() => setActiveTab("fault-analysis")}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "fault-analysis"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Fault Analysis
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "leaderboard"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Technician Leaderboard
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* ── KPI Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Jobs"      value={j.total ?? 0}           sub={`${j.active ?? 0} active`}        accent="border-blue-500" />
        <KpiCard label="Completed"       value={(j.completed ?? 0)}     sub="repaired & delivered"             accent="border-green-500" />
        <KpiCard label="Revenue (Total)" value={fmtLKR(r.total_paid)}   sub={`${r.unpaid_invoices ?? 0} unpaid invoices`} accent="border-purple-500" />
        <KpiCard label="Low Stock Parts" value={summary?.inventory?.low_stock_count ?? 0} sub="below minimum threshold" accent="border-red-500" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Pending Jobs"      value={j.pending ?? 0}         sub="awaiting assignment"     accent="border-gray-400" />
        <KpiCard label="Ready for Pickup"  value={j.ready_for_pickup ?? 0} sub="customer to collect"    accent="border-amber-500" />
        <KpiCard label="Revenue (Month)"   value={fmtLKR(r.month_paid)}   sub="current month, paid"    accent="border-teal-500" />
        <KpiCard label="Salvage Pending"   value={summary?.salvage?.pending_assessments ?? 0} sub="awaiting approval" accent="border-orange-500" />
      </div>

      {/* ── Charts Row 1: Revenue Trend ─────── */}
      <div className="grid grid-cols-1 gap-6">

        <Section title="Revenue — Last 6 Months (LKR)">
          {revTrend.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No paid invoices yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`LKR ${Number(v).toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>
      </div>
      )}

      {activeTab === "job-analysis" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Section title="Jobs Created — Last 30 Days">
            {jobsTrend.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No jobs in the last 30 days</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={jobsTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip labelFormatter={(d) => `Date: ${d}`} formatter={(v) => [v, "Jobs"]} />
                  <Area type="monotone" dataKey="jobs" stroke="#3b82f6" strokeWidth={2} fill="url(#jobGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* ── Charts Row 2: Status Pie ── */}
          <Section title="Job Status Distribution">
          {statusDist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No jobs yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={statusDist} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                    {statusDist.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n.replace(/_/g, " ")]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {statusDist.map((entry) => (
                  <div key={entry.status} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.status] ?? "#94a3b8" }} />
                    <span className="text-gray-600 dark:text-gray-300 capitalize">{entry.status.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-semibold text-gray-800 dark:text-gray-100">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
        </div>
      )}

      {activeTab === "fault-analysis" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm flex flex-wrap gap-4 items-end border border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Timeframe</label>
              <select 
                value={faultFilters.days} 
                onChange={(e) => setFaultFilters({ ...faultFilters, days: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 dark:bg-gray-900 dark:border-gray-700 dark:placeholder-gray-400 dark:text-gray-200"
              >
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="180">Last 6 Months</option>
              </select>
            </div>
            
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Brand</label>
              <select 
                value={faultFilters.brand} 
                onChange={(e) => setFaultFilters({ ...faultFilters, brand: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 dark:bg-gray-900 dark:border-gray-700 dark:placeholder-gray-400 dark:text-gray-200"
              >
                <option value="all">All Brands</option>
                <option value="Apple">Apple</option>
                <option value="Samsung">Samsung</option>
                <option value="Google">Google</option>
                <option value="OnePlus">OnePlus</option>
                <option value="Motorola">Motorola</option>
                <option value="Nokia">Nokia</option>
                <option value="Nothing">Nothing</option>
              </select>
            </div>
            
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Model</label>
              <input 
                type="text" 
                placeholder="e.g. iPhone 13"
                value={faultFilters.model} 
                onChange={(e) => setFaultFilters({ ...faultFilters, model: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 dark:bg-gray-900 dark:border-gray-700 dark:placeholder-gray-400 dark:text-gray-200"
              />
            </div>
            
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Job Status</label>
              <select 
                value={faultFilters.status} 
                onChange={(e) => setFaultFilters({ ...faultFilters, status: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 dark:bg-gray-900 dark:border-gray-700 dark:placeholder-gray-400 dark:text-gray-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed (Repaired)</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>

          <Section title="Fault Category Breakdown">
          {faultDist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No jobs yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={faultDist} layout="vertical" margin={{ top: 4, right: 16, left: 90, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="fault_category" tick={{ fontSize: 13 }} width={100} tickFormatter={(v) => v.replace(/_/g, " ")} />
                <Tooltip formatter={(v) => [v, "Jobs"]} labelFormatter={(l) => l.replace(/_/g, " ")} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {faultDist.map((_, i) => (
                    <Cell key={i} fill={FAULT_COLORS[i % FAULT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* ── Comprehensive Technician Leaderboard ─────────────────── */}
          <Section title="Comprehensive Technician Leaderboard">
            {combinedTechs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No technicians registered yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">Technician</th>
                      <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">Workload</th>
                      <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">Completed</th>
                      <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">Top Specialty</th>
                      <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">Score</th>
                      <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {combinedTechs.map((t, idx) => (
                      <tr key={t.technician_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="py-3 font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2 pr-4">
                          {idx === 0 && t.score !== null && <span title="Top Performer">🥇</span>}
                          {idx === 1 && t.score !== null && <span title="Runner Up">🥈</span>}
                          {idx === 2 && t.score !== null && <span title="Third Place">🥉</span>}
                          {idx > 2 && <span className="w-5 text-center text-gray-400 dark:text-gray-500">{idx + 1}</span>}
                          {(idx === 0 || idx === 1 || idx === 2) && t.score === null && <span className="w-5 text-center text-gray-400 dark:text-gray-500">{idx + 1}</span>}
                          {t.name}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-700 dark:text-gray-200">{t.total} <span className="font-normal text-xs text-gray-500">Total</span></span>
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{t.status_breakdown.in_progress ?? 0} Active</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 text-xs font-semibold" title="Completed">
                              {(t.status_breakdown.completed ?? 0) + (t.status_breakdown.delivered ?? 0)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {t.specialty ? (
                            <span className="px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-400 text-xs font-semibold">
                              ⭐ {t.specialty}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Evaluating...</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 min-w-[120px]">
                          {t.score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full" style={{width: `${Math.min(t.score, 100)}%`}}></div>
                              </div>
                              <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">{Math.round(t.score)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="py-3">
                          {t.rating ? (
                            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                              t.rating === "Excellent" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" :
                              t.rating === "Good" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400" : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400"
                            }`}>
                              {t.rating}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
