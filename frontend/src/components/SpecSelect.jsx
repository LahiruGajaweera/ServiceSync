import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

/**
 * Combobox for the part Spec / Identifier. Values are always upper-cased.
 * Lets the user pick an existing spec or save a new one to the registry.
 */
export default function SpecSelect({
  value = "",
  onChange,
  placeholder = "Select or type a spec…",
  id,
}) {
  const [specs, setSpecs] = useState([]);
  const [query, setQuery] = useState((value || "").toUpperCase());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery((value || "").toUpperCase());
  }, [value]);

  const load = async () => {
    try {
      const { data } = await api.get("/specs/");
      setSpecs(data.map((s) => s.name));
    } catch {
      setSpecs([]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim();
  const filtered = useMemo(() => {
    if (!q) return specs;
    const l = q.toLowerCase();
    return specs.filter((s) => s.toLowerCase().includes(l));
  }, [specs, q]);

  const exact = specs.some((s) => s.toLowerCase() === q.toLowerCase());
  const canAdd = q.length > 0 && !exact;

  const pick = (name) => {
    const up = name.toUpperCase();
    setQuery(up);
    onChange?.(up);
    setOpen(false);
  };

  const handleAddNew = async () => {
    if (!q || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post("/specs/", { name: q });
      if (!specs.some((s) => s.toLowerCase() === data.name.toLowerCase())) {
        setSpecs((prev) => [...prev, data.name].sort((a, b) => a.localeCompare(b)));
      }
      pick(data.name);
    } catch {
      pick(q);
    } finally {
      setSaving(false);
    }
  };

  const handleInput = (e) => {
    const v = e.target.value.toUpperCase();
    setQuery(v);
    onChange?.(v);
    setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canAdd) {
      e.preventDefault();
      handleAddNew();
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        id={id}
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (filtered.length > 0 || canAdd) && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                  s.toLowerCase() === query.trim().toLowerCase() ? "bg-blue-50 dark:bg-gray-700 font-medium text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
          {canAdd && (
            <li className="border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                disabled={saving}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNew}
                className="w-full text-left px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:text-blue-300 dark:disabled:text-gray-500 dark:text-gray-400"
              >
                {saving ? "Saving…" : `+ Add "${q}" as a new spec`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
