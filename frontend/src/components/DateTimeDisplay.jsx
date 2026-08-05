import { useState, useEffect } from 'react';

export default function DateTimeDisplay() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = dateTime.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const formattedTime = dateTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex items-center space-x-3 text-sm">
      <div className="font-semibold text-gray-900 text-base">
        {formattedTime}
      </div>
      <div className="font-medium text-gray-800 border-l border-gray-300 pl-3">
        {formattedDate}
      </div>
    </div>
  );
}
