import { useState, useEffect } from "react";
import AlertCard from "./AlertCard";

export default function AutoSlidingAlerts({ alerts = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length);
    }, 4000); // Auto-slide every 4 seconds
    return () => clearInterval(timer);
  }, [alerts.length]);

  if (alerts.length === 0) return null;

  const currentAlert = alerts[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div 
        key={currentIndex} 
        className="animate-in fade-in slide-in-from-right-4 duration-500"
      >
        <AlertCard
          type={currentAlert.status}
          title={currentAlert.part_name}
          value={`${currentAlert.restock_recommended} needed`}
          message={`Predicted demand: ${currentAlert.predicted_demand}. Current stock: ${currentAlert.current_stock}.`}
        />
      </div>
      
      {alerts.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
          {alerts.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                idx === currentIndex ? "w-4 bg-gray-800/60 dark:bg-gray-100/60" : "w-2 bg-gray-800/20 dark:bg-gray-100/20 hover:bg-gray-800/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
