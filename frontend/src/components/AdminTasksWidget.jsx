import { useState, useEffect } from "react";
import api from "../services/api";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

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
    <>
      <button
        onClick={() => setShowTasksModal(true)}
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

      <Modal open={showTasksModal} onClose={() => setShowTasksModal(false)} title="Pending Customer Calls">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Contact these customers before their devices are automatically salvaged.
        </p>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {adminTasks.map(task => (
            <div key={task.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col gap-3 shadow-sm">
              <div>
                <p className="font-mono text-xs font-bold text-red-600 dark:text-red-400 mb-1">{task.job_public_id}</p>
                <p className="text-gray-800 dark:text-gray-100 font-medium text-sm">{task.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Device: {task.device}</p>
              </div>
              <button
                onClick={() => handleCompleteTask(task.id)}
                className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 w-full py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Mark as Called ✓
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
