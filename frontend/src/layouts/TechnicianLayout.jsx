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
  { to: "/tech/jobs", label: "Job Queue" },
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
    <div className="flex h-screen bg-gray-100 dark:bg-gray-800 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-200 dark:border-gray-700">
          <p className="text-lg font-extrabold text-green-600 tracking-tight">ServiceSync</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Technician Panel</p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((item) => (
            <div key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center px-5 py-2.5 text-sm transition-colors border-l-2 ${
                  isActive(item) && (!item.exact || location.pathname === item.to)
                    ? "border-green-500 bg-green-50 text-green-700 font-medium"
                    : "border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 hover:text-gray-900 dark:text-white"
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

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-1.5 rounded transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shrink-0">
          <DateTimeDisplay />
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
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
