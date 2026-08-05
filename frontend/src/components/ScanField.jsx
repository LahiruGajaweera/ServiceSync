import { useEffect, useRef, useState } from "react";

/**
 * Scan-or-type field. Works with USB barcode/QR scanners and manual typing
 * (press Enter), and offers an optional phone-camera scanner via html5-qrcode.
 */
export default function ScanField({ onCode, placeholder = "Scan or type code, then Enter" }) {
  const [value, setValue] = useState("");
  const [cam, setCam] = useState(false);
  const [camError, setCamError] = useState("");
  const instanceRef = useRef(null);

  const emit = (code) => {
    const c = (code ?? "").trim();
    if (c) onCode(c);
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
            () => {}
          );
        } catch {
          if (!cancelled) setCamError("Unable to access camera. Use manual entry instead.");
        }
      })();
    }

    return () => {
      cancelled = true;
      if (instance) {
        instance.stop().then(() => instance.clear()).catch(() => {});
      }
      instanceRef.current = null;
    };
  }, [cam]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              emit(value);
              setValue("");
            }
          }}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setCam((c) => !c)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border ${cam ? "bg-red-50 border-red-200 text-red-600" : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"}`}
        >
          {cam ? "Stop" : "Camera"}
        </button>
      </div>
      {cam && <div id="scan-region" className="rounded-lg overflow-hidden border border-gray-200" />}
      {camError && <p className="text-xs text-red-500">{camError}</p>}
    </div>
  );
}
