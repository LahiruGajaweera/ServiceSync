import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import api from "../services/api";
import AdminJobDetailModal from "../pages/admin/AdminJobDetailModal";
import { useAuth } from "../context/AuthContext";

export default function RevertNotifications() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [pendingDonors, setPendingDonors] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    try {
      const [jobsRes, donorsRes] = await Promise.all([
        api.get("/jobs/?has_alerts=true"),
        user?.role === "admin" ? api.get("/donors/parts/pending").catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);
      const pending = jobsRes.data;
      setRequests(pending);

      const grouped = Object.values(
        donorsRes.data.reduce((acc, part) => {
          const devId = part.donor_device_id;
          if (!acc[devId]) acc[devId] = [];
          acc[devId].push(part);
          return acc;
        }, {})
      );
      setPendingDonors(grouped);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [user]);

  const unreadRequests = requests.filter(r => !r.admin_alert || !r.admin_alert.startsWith("[READ] "));
  const totalUnread = unreadRequests.length + pendingDonors.length;

  return (
    <div className="relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-100 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            {totalUnread}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}></div>
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadRequests.some(r => !!r.admin_alert) && (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      const alerts = unreadRequests.filter(r => !!r.admin_alert);
                      await Promise.all(alerts.map(req => api.patch(`/jobs/${req.id}/clear_alert`).catch(() => {})));
                      fetchRequests();
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Mark all as read
                  </button>
                )}
                {totalUnread > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">{totalUnread} new</span>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {(requests.length === 0 && pendingDonors.length === 0) ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">No new notifications</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {pendingDonors.map(group => {
                    const devId = group[0].donor_device_id;
                    return (
                      <div 
                        key={devId} 
                        className="p-5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 cursor-pointer"
                        onClick={() => { setShowDropdown(false); navigate('/admin/donors'); }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-base text-gray-800 dark:text-gray-100">Donor Extraction</p>
                          <span className="text-xs uppercase font-bold tracking-wider text-blue-600">Review Req</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">A technician submitted {group.length} parts for approval.</p>
                      </div>
                    );
                  })}
                  
                  {requests.map(req => {
                    const isAlert = !!req.admin_alert;
                    const isReadAlert = isAlert && req.admin_alert.startsWith("[READ] ");
                    const alertText = isReadAlert ? req.admin_alert.replace("[READ] ", "") : req.admin_alert;
                    return (
                    <div 
                      key={req.id} 
                      className={`p-5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 ${isReadAlert ? 'opacity-60 bg-gray-50 dark:bg-gray-900/50 grayscale' : ''}`}
                    >
                      <div 
                        className="cursor-pointer"
                        onClick={() => { setSelectedJobId(req.id); setShowDropdown(false); }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className={`font-bold text-base ${isReadAlert ? 'text-gray-600 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{req.job_id}</p>
                          <span className={`text-xs uppercase font-bold tracking-wider ${isAlert ? (isReadAlert ? 'text-gray-500' : 'text-red-600') : 'text-amber-600'}`}>
                            {isAlert ? (isReadAlert ? 'System Alert (Read)' : 'System Alert') : 'Revert Req'}
                          </span>
                        </div>
                        {isAlert ? (
                          <p className={`text-sm ${isReadAlert ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{alertText}</p>
                        ) : (
                          <>
                            <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">Technician {req.technician_name || "Unknown"} requested revert to <b>{req.revert_requested_to}</b>.</p>
                            {req.revert_reason && <p className="text-sm text-gray-600 dark:text-gray-300 italic mt-1.5">"{req.revert_reason}"</p>}
                          </>
                        )}
                      </div>
                      
                      {isAlert && !isReadAlert && (
                        <div className="mt-3 text-right">
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              await api.patch(`/jobs/${req.id}/clear_alert`).catch(() => {});
                              fetchRequests();
                            }}
                            className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded font-semibold transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {selectedJobId && createPortal(
        <AdminJobDetailModal 
          jobId={selectedJobId} 
          open={!!selectedJobId} 
          onClose={() => setSelectedJobId(null)} 
          onDone={() => { setSelectedJobId(null); fetchRequests(); }} 
        />,
        document.body
      )}
    </div>
  );
}
