import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

/**
 * Searchable brand dropdown.
 *
 * - Loads registered phone brands from GET /brands/.
 * - Lets the user type to filter (search) within the field.
 * - If the typed value isn't a registered brand, offers an
 *   "Add '<value>'" option that saves it to the system via POST /brands/.
 *
 * Controlled by a plain string `value` (the brand name), so it can be
 * dropped in wherever a brand text input was previously used.
 *
 * Props:
 *   value      string  — current brand name
 *   onChange   (name)  — called with the selected/added brand name
 *   placeholder string
 *   required   bool
 *   id         string
 */
export default function BrandSelect({
  value = "",
  onChange,
  placeholder = "Select or type a brand…",
  required = false,
  id,
}) {
  const [brands, setBrands] = useState([]);
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef(null);

  // Keep the visible text in sync when the parent value changes externally (e.g. form reset).
  useEffect(() => { setQuery(value || ""); }, [value]);

  const loadBrands = async () => {
    try {
      const { data } = await api.get("/brands/");
      setBrands(data.map((b) => b.name));
    } catch {
      setBrands([]);
    }
  };

  useEffect(() => { loadBrands(); }, []);

  // Close the dropdown when clicking outside the component.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim();

  const filtered = useMemo(() => {
    if (!q) return brands;
    const lower = q.toLowerCase();
    return brands.filter((b) => b.toLowerCase().includes(lower));
  }, [brands, q]);

  const exactMatch = brands.some((b) => b.toLowerCase() === q.toLowerCase());
  const canAddNew = q.length > 0 && !exactMatch;

  const pick = (name) => {
    setQuery(name);
    onChange?.(name);
    setOpen(false);
  };

  const handleAddNew = async () => {
    if (!q || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post("/brands/", { name: q });
      if (!brands.some((b) => b.toLowerCase() === data.name.toLowerCase())) {
        setBrands((prev) => [...prev, data.name].sort((a, b) => a.localeCompare(b)));
      }
      pick(data.name);
    } catch {
      // Saving failed — still let the user proceed with the typed value.
      pick(q);
    } finally {
      setSaving(false);
    }
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange?.(v);
    setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canAddNew) {
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
        required={required}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen(!open)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:text-gray-300 focus:outline-none"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (filtered.length > 0 || canAddNew) && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
          {filtered.map((b) => (
            <li key={b}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(b)}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                  b.toLowerCase() === q.toLowerCase() ? "bg-blue-50 dark:bg-gray-700 font-medium text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {b}
              </button>
            </li>
          ))}

          {canAddNew && (
            <li className="border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                disabled={saving}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNew}
                className="w-full text-left px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:text-blue-300 dark:disabled:text-gray-500 dark:text-gray-400"
              >
                {saving ? "Saving…" : `+ Add "${q}" as a new brand`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
