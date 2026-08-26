import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import ThemeToggle from "../components/ThemeToggle";
import RevertNotifications from "../components/RevertNotifications";
import DateTimeDisplay from "../components/DateTimeDisplay";

const NAV = [
  { to: "/tech",      label: "My Dashboard", exact: true },
  { to: "/tech/workspace", label: "Active Workspace" },
  { to: "/tech/jobs", label: "Customer Repairs" },
  { to: "/tech/refurbish", label: "Store Refurbishments" },
  { to: "/tech/donors", label: "Donor Devices" },
];

export default function TechnicianLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeJobs, setActiveJobs] = useState([]);

  useEffect(() => {
    const fetchActiveJobs = () => {
      if (user?.role === "technician") {
        api.get("/jobs/mine")
          .then(res => setActiveJobs(res.data.filter(j => j.status === "in_progress")))
          .catch(() => {});
      }
    };
    fetchActiveJobs();
    window.addEventListener("refreshActiveJobs", fetchActiveJobs);
    return () => window.removeEventListener("refreshActiveJobs", fetchActiveJobs);
  }, [user]);

  const isActive = (item) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white/60 dark:bg-gray-900/50 backdrop-blur-xl border-r border-white/30 dark:border-gray-800/50 flex flex-col shadow-2xl z-20">
        <div className="px-5 py-5 border-b border-gray-200 dark:border-gray-700">
          <p className="text-lg font-extrabold text-green-600 tracking-tight">ServiceSync</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Technician Panel</p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((item) => (
            <div key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center mx-3 my-1 px-4 py-2.5 text-sm rounded-xl transition-all duration-300 ${
                  isActive(item) && (!item.exact || location.pathname === item.to)
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold shadow-md shadow-green-500/20"
                    : "text-gray-600 dark:text-gray-400 hover:bg-green-50 hover:text-green-700 dark:hover:bg-gray-800/50 dark:hover:text-green-400"
                }`}
              >
                {item.label}
              </Link>
              {item.to === "/tech/workspace" && isActive(item) && activeJobs.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900/30 py-2 border-y border-gray-100 dark:border-gray-800">
                  {activeJobs.map(job => {
                    const isSelected = new URLSearchParams(location.search).get("job") === String(job.id);
                    return (
                      <Link
                        key={job.id}
                        to={`/tech/workspace?job=${job.id}`}
                        className={`block pl-9 pr-5 py-2 text-xs transition-colors border-l-2 ${
                          isSelected
                            ? "border-green-400 text-green-700 font-bold dark:text-green-400 bg-green-50/50 dark:bg-green-900/10"
                            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{job.job_id}</span>
                          <span className="truncate ml-2 opacity-80">{job.device_model}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white/60 dark:bg-gray-900/50 backdrop-blur-xl border-b border-white/30 dark:border-gray-800/50 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <DateTimeDisplay />
            <div className="hidden sm:block border-l border-gray-200 dark:border-gray-700 pl-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Welcome, <span className="font-bold text-green-600 dark:text-green-400">{user?.name}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <RevertNotifications />
            <Link
              to="profile"
              className="relative p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800"
              aria-label="My Profile"
              title="My Profile"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <button
              onClick={handleLogout}
              className="ml-1 relative p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
              aria-label="Sign Out"
              title="Sign Out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
