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

function getTechnicianPerformance(specializations) {
  if (!specializations) return { score: 0, category: 'General' };
  
  const skills = specializations.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  let score = skills.length * 10; 
  
  let category = 'General';
  if (skills.some(s => s.includes('board') || s.includes('chip') || s.includes('ic') || s.includes('micro'))) {
    category = 'Board Level Expert';
    score += 20; 
  } else if (skills.some(s => s.includes('screen') || s.includes('display') || s.includes('glass') || s.includes('lcd'))) {
    category = 'Screen Repair Specialist';
  } else if (skills.some(s => s.includes('software') || s.includes('flash') || s.includes('unlock'))) {
    category = 'Software Specialist';
  } else if (skills.some(s => s.includes('apple') || s.includes('iphone') || s.includes('mac') || s.includes('ios'))) {
    category = 'Apple Specialist';
  } else if (skills.length > 0) {
    category = skills[0].charAt(0).toUpperCase() + skills[0].slice(1) + ' Specialist';
  }
  
  return { score: Math.min(score, 100), category };
}

export default function TechnicianPanel() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('active'); // 'active' or 'inactive'
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [created, setCreated]         = useState(null); // { name, temporary_password, sms_sent }
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [showJobsList, setShowJobsList] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', onConfirm: null });

  const fetchTechnicians = async () => {
    setLoading(true);
    try {
      const [usersRes, jobsRes] = await Promise.all([
        api.get("/users/"),
        api.get("/jobs/")
      ]);
      const jobs = jobsRes.data;

      const techs = usersRes.data.filter((u) => u.role === "technician").map(t => {
        const perf = getTechnicianPerformance(t.specializations);
        const activeJobsList = jobs.filter(j => j.technician_id === t.id && ['pending', 'in_progress'].includes(j.status));
        return { ...t, performanceScore: perf.score, category: perf.category, activeJobs: activeJobsList.length, activeJobsList };
      });
      techs.sort((a, b) => b.performanceScore - a.performanceScore);
      setTechnicians(techs);
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

  const handleToggleStatus = () => {
    if (!selectedTechnician) return;
    const action = selectedTechnician.is_active ? "deactivate" : "activate";
    
    setConfirmModal({
      isOpen: true,
      action: action,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, action: '', onConfirm: null });
        setDeleting(true);
        try {
          await api.patch(`/admin/technicians/${selectedTechnician.id}/toggle-status`);
          setSelectedTechnician(null);
          fetchTechnicians();
        } catch (err) {
          alert(`Failed to ${action} technician`);
        } finally {
          setDeleting(false);
        }
      }
    });
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Technician Panel</h2>
          <p className="text-sm text-gray-500 mt-0.5">{technicians.length} total technicians</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setCreated(null); setFormError(""); setForm(EMPTY_FORM); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Add Technician
        </button>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`pb-3 px-6 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveTab('active')}
        >
          Active Technicians ({technicians.filter(t => t.is_active).length})
        </button>
        <button
          className={`pb-3 px-6 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'inactive' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveTab('inactive')}
        >
          Inactive Technicians ({technicians.filter(t => !t.is_active).length})
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
          {technicians.filter(t => activeTab === 'active' ? t.is_active : !t.is_active).map((t) => (
            <div 
              key={t.id} 
              className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-gray-200"
              onClick={() => { setSelectedTechnician(t); setShowJobsList(false); }}
            >
              <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">{t.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md border border-blue-100">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path></svg>
                    Score: {t.performanceScore}
                  </span>
                  <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-semibold rounded-md border border-purple-100">
                    {t.category}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-md border border-orange-100">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    {t.activeJobs} Active Jobs
                  </span>
                </div>
                {t.specializations && (
                  <p className="text-xs text-gray-600 truncate mt-2">Skills: {t.specializations}</p>
                )}
                <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {t.is_active ? 'Active' : 'Inactive'}
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

      <Modal open={!!selectedTechnician} onClose={() => { setSelectedTechnician(null); setShowJobsList(false); }} title="Technician Details">
        {selectedTechnician && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shrink-0">
                {selectedTechnician.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedTechnician.name}</h3>
                <p className="text-sm text-gray-500">{selectedTechnician.email}</p>
                {selectedTechnician.phone_number && (
                  <p className="text-sm text-gray-500">{selectedTechnician.phone_number}</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div>
                <span className="block text-xs font-semibold text-gray-500 mb-1">Performance Category</span>
                <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-md border border-purple-200">
                  {selectedTechnician.category}
                </span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-gray-500 mb-1">Current Workload</span>
                <button 
                  onClick={() => setShowJobsList(!showJobsList)}
                  disabled={selectedTechnician.activeJobs === 0}
                  className={`inline-flex items-center px-2 py-1 text-xs font-bold rounded-md border transition-colors ${
                    selectedTechnician.activeJobs === 0 
                      ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : showJobsList 
                        ? 'bg-orange-600 text-white border-orange-700' 
                        : 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  {selectedTechnician.activeJobs} Active {selectedTechnician.activeJobs === 1 ? 'Job' : 'Jobs'} {selectedTechnician.activeJobs > 0 && (showJobsList ? '▼' : '▶')}
                </button>
                {showJobsList && selectedTechnician.activeJobsList?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedTechnician.activeJobsList.map(job => (
                      <div key={job.id} className="text-xs bg-white border border-gray-200 rounded p-2 flex justify-between items-center shadow-sm">
                        <span className="font-semibold text-gray-700">{job.job_id} - {job.device_brand} {job.device_model}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <span className="block text-xs font-semibold text-gray-500 mb-1">Performance Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${selectedTechnician.performanceScore}%` }}></div>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{selectedTechnician.performanceScore}</span>
                </div>
              </div>

              {selectedTechnician.specializations && (
                <div>
                  <span className="block text-xs font-semibold text-gray-500 mb-1">Special Skills</span>
                  <p className="text-sm text-gray-700">{selectedTechnician.specializations}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button" 
                onClick={() => { setSelectedTechnician(null); setShowJobsList(false); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                type="button" 
                onClick={handleToggleStatus}
                disabled={deleting}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  selectedTechnician.is_active 
                    ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-100" 
                    : "bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 border-green-100"
                }`}
              >
                {deleting ? "Processing…" : (selectedTechnician.is_active ? "Deactivate" : "Activate")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal 
        open={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ isOpen: false, action: '', onConfirm: null })} 
        title="Confirm Action"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Are you sure you want to {confirmModal.action} this technician?
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button" 
              onClick={() => setConfirmModal({ isOpen: false, action: '', onConfirm: null })}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button" 
              onClick={confirmModal.onConfirm}
              className={`flex-1 text-white py-2 rounded-lg text-sm font-semibold transition-colors ${confirmModal.action === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              Yes, {confirmModal.action}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
