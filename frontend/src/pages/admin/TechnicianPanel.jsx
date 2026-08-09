import { useEffect, useState } from "react";
import api from "../../services/api";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: "", email: "", phone_number: "", specializations: "" };

export default function TechnicianPanel() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [created, setCreated]         = useState(null); // { name, temporary_password, sms_sent }

  const fetchTechnicians = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users/");
      setTechnicians(data.filter((u) => u.role === "technician"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTechnicians(); }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const { data } = await api.post("/admin/technicians", form);
      setForm(EMPTY_FORM);
      setCreated({
        name: data.user.name,
        temporary_password: data.temporary_password,
        sms_sent: data.sms_sent,
      });
      fetchTechnicians();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to add technician");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setCreated(null);
    setFormError("");
    setForm(EMPTY_FORM);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Technician Panel</h2>
          <p className="text-sm text-gray-500 mt-0.5">{technicians.length} active technicians</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setCreated(null); setFormError(""); setForm(EMPTY_FORM); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Add Technician
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
      ) : technicians.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-20 text-center border-2 border-dashed border-gray-200">
          <p className="font-medium text-gray-500">No technicians yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first technician using the button above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {technicians.map((t) => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">{t.email}</p>
                {t.specializations && (
                  <p className="text-xs text-gray-600 truncate mt-1">Skills: {t.specializations}</p>
                )}
                <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title="Add New Technician">
        {created ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800">
                {created.name} added successfully.
              </p>
              <p className="text-xs text-green-700 mt-1">
                {created.sms_sent
                  ? "The temporary password was sent to their phone via SMS."
                  : "SMS is not configured — share the temporary password below with the technician."}
              </p>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
        <form onSubmit={handleAdd} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
            <input
              name="name" required value={form.name} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
            <input
              name="email" type="email" required value={form.email} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tech@servicesync.lk"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number *</label>
            <input
              name="phone_number" type="tel" required value={form.phone_number} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="07XXXXXXXX"
            />
            <p className="text-xs text-gray-400 mt-1">A temporary password will be sent here via SMS.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Specializations / Skills</label>
            <input
              name="specializations" value={form.specializations} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. iPhone, Samsung, Board level repair"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={closeModal}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? "Adding…" : "Add Technician"}
            </button>
          </div>
        </form>
        )}
      </Modal>
    </div>
  );
}
