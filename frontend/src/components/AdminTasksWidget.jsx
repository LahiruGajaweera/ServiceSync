import { useState, useEffect } from "react";
import api from "../services/api";

export default function AdminTasksWidget() {
  const [adminTasks, setAdminTasks] = useState([]);
  const [showTasksModal, setShowTasksModal] = useState(false);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get("/admin-tasks/");
      setAdminTasks(data);
    } catch (err) {
      console.error("Failed to fetch admin tasks", err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCompleteTask = async (taskId) => {
    try {
      await api.patch(`/admin-tasks/${taskId}/complete`);
      fetchTasks();
    } catch (err) {
      alert("Failed to complete task");
    }
  };

  if (adminTasks.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowTasksModal(!showTasksModal)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold text-xs shadow-sm hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
        title="Pending Customer Calls"
      >
        <span>🚨</span>
        <span>{adminTasks.length} Calls</span>
        <span className="absolute top-0 right-0 flex h-2.5 w-2.5 -mt-1 -mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      </button>

      {showTasksModal && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowTasksModal(false)}></div>
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Pending Customer Calls</h3>
            </div>
            
            <div className="p-5">
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                Contact these customers before their devices are automatically salvaged.
              </p>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1 hide-scrollbar">
                {adminTasks.map(task => (
                  <div key={task.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col gap-3 shadow-sm">
                    <div>
                      <p className="font-mono text-xs font-bold text-red-600 dark:text-red-400 mb-1">{task.job_public_id}</p>
                      <p className="text-gray-800 dark:text-gray-100 font-medium text-sm leading-snug">{task.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <p className="font-medium text-gray-700 dark:text-gray-300">{task.customer_name}</p>
                          <p>Device: {task.device}</p>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {task.customer_phone || "No Number"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 w-full py-2 rounded-lg text-xs font-semibold transition-colors mt-1"
                    >
                      Mark as Called ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
