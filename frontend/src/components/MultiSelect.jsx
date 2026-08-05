import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

/**
 * Generic multi-select with removable chips, backed by a registry endpoint.
 * Selecting from the list (instead of free typing) prevents data-entry typos.
 *
 * Props:
 *  - value: string[]                selected names
 *  - onChange: (string[]) => void
 *  - fetchUrl: string              registry endpoint returning [{ name }]
 *  - fetchParams: object           optional query params
 *  - placeholder, addNoun
 *  - allowAdd: boolean             show "+ Add new" affordance
 *  - onAddNew: async (name) => savedName   persist a new option
 */
export default function MultiSelect({
  value = [],
  onChange,
  fetchUrl,
  fetchParams,
  placeholder = "Search…",
  allowAdd = false,
  addNoun = "item",
  onAddNew,
  disabled = false,
}) {
  const [options, setOptions] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef(null);

  const paramsKey = JSON.stringify(fetchParams || null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(fetchUrl, { params: fetchParams });
        if (!cancelled) setOptions(data.map((o) => o.name));
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, paramsKey]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim();
  const selectedLower = useMemo(
    () => new Set(value.map((v) => v.toLowerCase())),
    [value]
  );
  const filtered = useMemo(() => {
    const base = options.filter((o) => !selectedLower.has(o.toLowerCase()));
    if (!q) return base;
    const l = q.toLowerCase();
    return base.filter((o) => o.toLowerCase().includes(l));
  }, [options, q, selectedLower]);

  const exists = options.some((o) => o.toLowerCase() === q.toLowerCase());
  const alreadySelected = selectedLower.has(q.toLowerCase());
  const canAdd = allowAdd && q.length > 0 && !exists && !alreadySelected;

  const add = (name) => {
    if (!selectedLower.has(name.toLowerCase())) onChange?.([...value, name]);
    setQuery("");
    setOpen(true);
  };
  const remove = (name) =>
    onChange?.(value.filter((v) => v.toLowerCase() !== name.toLowerCase()));

  const handleAddNew = async () => {
    if (!canAdd || saving) return;
    setSaving(true);
    try {
      const saved = onAddNew ? await onAddNew(q) : q;
      if (!options.some((o) => o.toLowerCase() === saved.toLowerCase())) {
        setOptions((prev) => [...prev, saved].sort((a, b) => a.localeCompare(b)));
      }
      add(saved);
    } catch {
      add(q);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                disabled={disabled}
                className="text-blue-400 hover:text-blue-700 leading-none text-sm disabled:text-blue-200 disabled:cursor-not-allowed"
                aria-label={`Remove ${v}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!canAdd && filtered.length) add(filtered[0]);
            else if (canAdd) handleAddNew();
          }
        }}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      {!disabled && open && (filtered.length > 0 || canAdd) && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-gray-700"
              >
                {o}
              </button>
            </li>
          ))}
          {canAdd && (
            <li className="border-t border-gray-100">
              <button
                type="button"
                disabled={saving}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNew}
                className="w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 font-medium disabled:text-blue-300"
              >
                {saving ? "Saving…" : `+ Add "${q}" as a new ${addNoun}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
