import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import PhoneInput from "./PhoneInput";

export default function SupplierSelect({ value, onChange }) {
  const [search, setSearch] = useState(value || "");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Inline new supplier state
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone_number: "", email: "", address: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (q) => {
    setSearch(q);
    onChange(q); // The parent wants a string (supplier name)
    setShowNew(false);
    setError("");

    if (q.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    setShowDropdown(true);
    try {
      const { data } = await api.get("/suppliers/", { params: { search: q } });
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const selectSupplier = (s) => {
    setSearch(s.name);
    onChange(s.name); // Using name instead of ID since inventory model expects string
    setShowDropdown(false);
  };

  const openNewSupplier = () => {
    setShowDropdown(false);
    setShowNew(true);
    setError("");
    setNewForm({ name: search.trim(), phone_number: "", email: "", address: "" });
  };

  const handleCreate = async () => {
    if (!newForm.name || !newForm.phone_number) {
      setError("Name and phone number are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/suppliers/", newForm);
      setShowNew(false);
      selectSupplier(data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      let errMsg = "Failed to add supplier";
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map(d => d.msg).join(", ");
      }
      setError(errMsg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => { if (search.trim().length >= 2) setShowDropdown(true); }}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type name or phone..."
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searching ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Searching...</div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectSupplier(s)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 dark:hover:bg-gray-700 dark:focus:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-800 dark:border-gray-700 last:border-0"
                  >
                    <p className="font-semibold text-gray-800 dark:text-gray-100 dark:text-gray-200 text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.phone_number}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No suppliers found</div>
          )}
          {!searching && search.trim() && (
            <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky bottom-0">
              <button
                type="button"
                onClick={openNewSupplier}
                className="w-full text-center px-3 py-2 bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-600 rounded text-xs font-semibold transition-colors"
              >
                + Add "{search.trim()}" as new
              </button>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="mt-3 p-4 bg-blue-50/50 border border-blue-200 rounded-xl relative">
          <button
            type="button"
            onClick={() => setShowNew(false)}
            className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 font-bold"
          >
            &times;
          </button>
          <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">New Supplier</p>

          {error && <div className="mb-3 p-2 bg-red-100 text-red-700 text-xs rounded border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone *</label>
              <PhoneInput
                name="phone_number"
                value={newForm.phone_number}
                onChange={(e) => setNewForm((f) => ({ ...f, phone_number: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm"
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Address</label>
              <input
                type="text"
                value={newForm.address}
                onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm"
                placeholder="optional"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {creating ? "Saving..." : "Save Supplier & Select"}
          </button>
        </div>
      )}
    </div>
  );
}
