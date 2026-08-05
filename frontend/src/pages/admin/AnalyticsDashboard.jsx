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
    <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${accent}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

const fmtLKR = (n) =>
  n == null ? "—" : `LKR ${Number(n).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

export default function AnalyticsDashboard() {
  const [summary, setSummary]       = useState(null);
  const [jobsTrend, setJobsTrend]   = useState([]);
  const [revTrend, setRevTrend]     = useState([]);
  const [techStats, setTechStats]   = useState([]);
  const [faultDist, setFaultDist]   = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, jobsRes, revRes, techRes, faultRes, statusRes] = await Promise.all([
          api.get("/analytics/summary"),
          api.get("/analytics/jobs-trend", { params: { days: 30 } }),
          api.get("/analytics/revenue-trend", { params: { months: 6 } }),
          api.get("/analytics/technician-stats"),
          api.get("/analytics/fault-distribution"),
          api.get("/analytics/status-distribution"),
        ]);
        setSummary(sumRes.data);
        setJobsTrend(jobsRes.data);
        setRevTrend(revRes.data);
        setTechStats(techRes.data);
        setFaultDist(faultRes.data);
        setStatusDist(statusRes.data);
      } catch (e) {
        setError("Failed to load analytics. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-800">Analytics Dashboard</h2>
        <span className="text-xs text-gray-400">Live data from ServiceSync</span>
      </div>

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

      {/* ── Charts Row 1: Jobs Trend + Revenue Trend ─────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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

      {/* ── Charts Row 2: Status Pie + Fault Distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                    <span className="text-gray-600 capitalize">{entry.status.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-semibold text-gray-800">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Fault Category Breakdown">
          {faultDist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No jobs yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={faultDist} layout="vertical" margin={{ top: 4, right: 16, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="fault_category" tick={{ fontSize: 10 }} width={68} tickFormatter={(v) => v.replace(/_/g, " ")} />
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

      {/* ── Technician Performance Table ─────────────────── */}
      <Section title="Technician Performance">
        {techStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No technicians registered yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Technician", "Total Jobs", "Active", "Completed", "Delivered", "Unclaimed"].map((h) => (
                    <th key={h} className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {techStats.map((t) => (
                  <tr key={t.technician_id} className="hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-800 pr-4">{t.name}</td>
                    <td className="py-2.5 font-bold text-gray-700 pr-4">{t.total}</td>
                    <td className="py-2.5 pr-4">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {t.status_breakdown.in_progress ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                        {t.status_breakdown.completed ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        {t.status_breakdown.delivered ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                        {t.status_breakdown.unclaimed ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
