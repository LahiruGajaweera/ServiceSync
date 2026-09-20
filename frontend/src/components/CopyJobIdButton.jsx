import { useState } from "react";

export default function CopyJobIdButton({ jobId }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex items-center">
      <button 
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy Job ID"}
        className={`transition-all p-0.5 rounded-md flex items-center justify-center ${
          copied 
            ? "text-green-500 bg-green-50 dark:bg-green-900/30 opacity-100" 
            : "text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"
        }`}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      
      {/* Tooltip / Feedback */}
      <div 
        className={`absolute left-full ml-2 px-1.5 py-0.5 rounded shadow-sm border text-[10px] font-bold whitespace-nowrap transition-all duration-300 pointer-events-none ${
          copied 
            ? "opacity-100 translate-x-0 bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" 
            : "opacity-0 -translate-x-2 bg-transparent text-transparent border-transparent"
        }`}
      >
        Copied!
      </div>
    </div>
  );
}
