import { useEffect, useState } from "react";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
import SmartPartsPanel from "../../components/SmartPartsPanel";

const STATUS_OPTIONS = [
  { value: "in_progress",      label: "Mark In Progress" },
  { value: "completed",        label: "Mark Completed" },
  { value: "failed",           label: "Fail Job (Unidentified Fault)" },
  { value: "rejected",         label: "Fail Job (Identified but Unrepairable)" },
];

import TechJobDetailBody from "./TechJobDetailBody";

export default function TechJobDetailModal({ open, job, onClose, onDone, onOpenPartLog, partRefreshTrigger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="glass-panel bg-white/90 dark:bg-gray-800/90 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-white/50 dark:border-gray-700/50" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700/50 shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Job Detail — {job.job_id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl leading-none">&times;</button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto">
          <TechJobDetailBody
            job={job}
            onClose={onClose}
            onDone={onDone}
            onOpenPartLog={onOpenPartLog}
            partRefreshTrigger={partRefreshTrigger}
          />
        </div>
      </div>
    </div>
  );
}
