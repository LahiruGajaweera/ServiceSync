import { useEffect, useRef, useState } from "react";
import api from "../services/api";

/**
 * Scan-or-type field. Works with USB barcode/QR scanners and manual typing
 * (press Enter), and offers an optional phone-camera scanner via html5-qrcode.
 */
export default function ScanField({ onCode, placeholder = "Scan or type code, then Enter", searchEndpoint = null }) {
  const [value, setValue] = useState("");
  const [cam, setCam] = useState(false);
  const [camError, setCamError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const instanceRef = useRef(null);
  const debounceRef = useRef(null);

  const emit = (code) => {
    const c = (code ?? "").trim();
    if (c) {
      onCode(c);
      setShowSuggestions(false);
    }

  };

  useEffect(() => {
    let cancelled = false;
    let instance = null;

    if (cam) {
      setCamError("");
      (async () => {
        try {
          const { Html5Qrcode } = await import("html5-qrcode");
          if (cancelled) return;
          instance = new Html5Qrcode("scan-region");
          instanceRef.current = instance;
          await instance.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 200 },
            (decoded) => { emit(decoded); setCam(false); },
            () => { }
          );
        } catch {
          if (!cancelled) setCamError("Unable to access camera. Use manual entry instead.");
        }
      })();
    }

    return () => {
      cancelled = true;
      if (instance) {
        instance.stop().then(() => instance.clear()).catch(() => { });
      }
      instanceRef.current = null;
    };
  }, [cam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);

    if (searchEndpoint) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (val.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get(`${searchEndpoint}?q=${encodeURIComponent(val)}`);
          setSuggestions(data);
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
        }
      }, 300);
    }
  };

  return (
    <div className="space-y-2 relative">
      <div className="flex gap-2">
        <input
          value={value}
          autoFocus
          onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              emit(value);
              setValue("");
            }
          }}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setCam((c) => !c)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border ${cam ? "bg-red-50 border-red-200 text-red-600" : "bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800"}`}
        >
          {cam ? "Stop" : "Camera"}
        </button>
      </div>
      {cam && <div id="scan-region" className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" />}
      {camError && <p className="text-xs text-red-500">{camError}</p>}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1 top-full">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(s);
                emit(s);
                setValue("");
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
