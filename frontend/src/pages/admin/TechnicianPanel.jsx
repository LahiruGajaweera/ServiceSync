import React, { useEffect, useState } from "react";
import api from "../../services/api";
import PhoneInput from "../../components/PhoneInput";
import { isValidPhoneNumber } from "../../utils/validation";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="glass-panel bg-white/90 dark:bg-gray-800/90 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-up border border-white/50 dark:border-gray-700/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700/50">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: "", email: "", phone_number: "", specializations: "" };

const SKILL_OPTIONS = [
  "Apple devices",
  "Android devices",
  "Board level repair",
  "Screen repair",
  "Software troubleshooting",
  "Micro-soldering",
  "Battery replacement",
  "Water damage recovery"
];

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
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [created, setCreated]         = useState(null); // { name, temporary_password, sms_sent }
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [showJobsList, setShowJobsList] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', onConfirm: null });
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [availableSkills, setAvailableSkills] = useState(SKILL_OPTIONS);
  const [skillSearch, setSkillSearch] = useState("");

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

      // Aggregate all unique skills from existing technicians
      const allSkills = new Set(SKILL_OPTIONS);
      techs.forEach(t => {
        if (t.specializations) {
          t.specializations.split(',').forEach(s => {
            const trimmed = s.trim();
            if (trimmed) {
              allSkills.add(trimmed);
            }
          });
        }
      });
      setAvailableSkills(Array.from(allSkills));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTechnicians(); }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
  const handleSkillToggle = (skill) => {
    const currentSkills = form.specializations ? form.specializations.split(',').map(s => s.trim()).filter(Boolean) : [];
    let newSkills;
    if (currentSkills.includes(skill)) {
      newSkills = currentSkills.filter(s => s !== skill);
    } else {
      newSkills = [...currentSkills, skill];
    }
    setForm({ ...form, specializations: newSkills.join(', ') });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.email || payload.email.trim() === "") {
        delete payload.email;
      }
      
      if (editingTechnician) {
        await api.put(`/admin/technicians/${editingTechnician.id}`, payload);
        fetchTechnicians();
        closeModal();
      } else {
        const { data } = await api.post("/admin/technicians", payload);
        setForm(EMPTY_FORM);
        setCreated({
          name: data.user.name,
          temporary_password: data.temporary_password,
          sms_sent: data.sms_sent,
        });
        fetchTechnicians();
      }
    } catch (err) {
      let errorMsg = `Failed to ${editingTechnician ? 'update' : 'add'} technician`;
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join(", ");
        } else if (typeof err.response.data.detail === "string") {
          errorMsg = err.response.data.detail;
        } else {
          errorMsg = JSON.stringify(err.response.data.detail);
        }
      }
      setFormError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setCreated(null);
    setFormError("");
    setForm(EMPTY_FORM);
    setEditingTechnician(null);
    setShowSkillDropdown(false);
    setSkillSearch("");
  };

  const handleToggleStatus = (tech) => {
    if (!tech) return;
    const action = tech.is_active ? "deactivate" : "activate";
    
    setConfirmModal({
      isOpen: true,
      action: action,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, action: '', onConfirm: null });
        setDeleting(true);
        try {
          await api.patch(`/admin/technicians/${tech.id}/toggle-status`);
          if (selectedTechnician?.id === tech.id) setSelectedTechnician(null);
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Technician Panel</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{technicians.length} total technicians</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setCreated(null); setFormError(""); setForm(EMPTY_FORM); setShowSkillDropdown(false); }}
          className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl glass-button shadow-lg shadow-blue-500/30"
        >
          + Add Technician
        </button>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          className={`pb-3 px-6 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600'}`}
          onClick={() => setActiveTab('active')}
        >
          Active Technicians ({technicians.filter(t => t.is_active).length})
        </button>
        <button
          className={`pb-3 px-6 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'inactive' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600'}`}
          onClick={() => setActiveTab('inactive')}
        >
          Inactive Technicians ({technicians.filter(t => !t.is_active).length})
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
      ) : technicians.length === 0 ? (
        <div className="glass-panel rounded-2xl py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700/50">
          <p className="font-medium text-gray-500 dark:text-gray-400">No technicians yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first technician using the button above</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technician</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Specializations</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Jobs</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
              {technicians.filter(t => activeTab === 'active' ? t.is_active : !t.is_active).map((t) => {
                const isSelected = selectedTechnician?.id === t.id;
                return (
                  <React.Fragment key={t.id}>
                    <tr 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      onClick={() => { setSelectedTechnician(isSelected ? null : t); setShowJobsList(false); }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shrink-0">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{t.name}</p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">{t.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{t.email}</p>
                        {t.phone_number && <p className="text-xs text-gray-500">{t.phone_number}</p>}
                      </td>
                      <td className="p-4 max-w-[200px] truncate text-sm text-gray-600 dark:text-gray-400">
                        {t.specializations || '-'}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md border border-blue-100">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path></svg>
                          {t.performanceScore}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-md border border-orange-100">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                          {t.activeJobs}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-3">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation();
                              setEditingTechnician(t);
                              setForm({
                                name: t.name,
                                email: t.email || "",
                                phone_number: t.phone_number || "",
                                specializations: t.specializations || ""
                              });
                              setShowModal(true);
                            }}
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                            title="Edit Technician"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(t); }}
                            disabled={deleting}
                            title={t.is_active ? "Deactivate" : "Activate"}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${t.is_active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${t.is_active ? 'translate-x-4.5' : 'translate-x-1'}`} style={{ transform: t.is_active ? 'translateX(1.125rem)' : 'translateX(0.25rem)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {isSelected && (
                      <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-750">
                        <td colSpan="6" className="p-6 border-l-4 border-blue-500">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">

                              
                              <div>
                                <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Current Workload</span>
                                {t.activeJobs > 0 ? (
                                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {t.activeJobsList?.map(job => (
                                      <div key={job.id} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 flex justify-between items-center shadow-sm">
                                        <span className="font-semibold text-gray-700 dark:text-gray-200">{job.job_id} - {job.device_brand} {job.device_model}</span>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {job.status.replace('_', ' ')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No active jobs</p>
                                )}
                              </div>
                            </div>

                            <div className="space-y-4 flex flex-col justify-between">
                              {t.specializations && (
                                <div>
                                  <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Special Skills</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {t.specializations.split(',').map((skill, idx) => (
                                      <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600">
                                        {skill.trim()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title={editingTechnician ? "Edit Technician" : "Add New Technician"}>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Full Name *</label>
            <input
              name="name" required value={form.name} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Email</label>
            <input
              name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tech@servicesync.lk (optional)"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone Number *</label>
            <PhoneInput
              name="phone_number" required value={form.phone_number} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="07XXXXXXXX"
            />
            <p className="text-xs text-gray-400 mt-1">A temporary password will be sent here via SMS.</p>
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Specializations / Skills</label>
            <div 
              className="w-full border border-gray-300 dark:bg-transparent dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-h-[38px] flex items-center justify-between"
              onClick={() => setShowSkillDropdown(!showSkillDropdown)}
            >
              <span className={form.specializations ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}>
                {form.specializations || "Select skills..."}
              </span>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${showSkillDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            
            {showSkillDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 flex flex-col">
                <div className="p-2 border-b dark:border-gray-700">
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Search or add new skill..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 focus:outline-none focus:border-blue-500 text-gray-800 dark:text-gray-100"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (skillSearch.trim()) {
                          const newSkill = skillSearch.trim();
                          handleSkillToggle(newSkill);
                          if (!availableSkills.find(s => s.toLowerCase() === newSkill.toLowerCase())) {
                            setAvailableSkills(prev => [...prev, newSkill]);
                          }
                          setSkillSearch('');
                        }
                      }
                    }}
                  />
                </div>
                <div className="overflow-y-auto">
                  {availableSkills
                    .filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()))
                    .map(skill => {
                      const isSelected = (form.specializations || "").split(',').map(s => s.trim()).includes(skill);
                      return (
                        <div 
                          key={skill}
                          className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                          onClick={() => handleSkillToggle(skill)}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{skill}</span>
                        </div>
                      );
                  })}
                  {skillSearch.trim() && !availableSkills.find(s => s.toLowerCase() === skillSearch.trim().toLowerCase()) && (
                    <div 
                      className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-blue-600 dark:text-blue-400 font-medium border-t dark:border-gray-700"
                      onClick={() => {
                        const newSkill = skillSearch.trim();
                        handleSkillToggle(newSkill);
                        if (!availableSkills.find(s => s.toLowerCase() === newSkill.toLowerCase())) {
                          setAvailableSkills(prev => [...prev, newSkill]);
                        }
                        setSkillSearch('');
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      Add "{skillSearch.trim()}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={closeModal}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? (editingTechnician ? "Saving…" : "Adding…") : (editingTechnician ? "Save Changes" : "Add Technician")}
            </button>
          </div>
        </form>
        )}
      </Modal>



      <Modal 
        open={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ isOpen: false, action: '', onConfirm: null })} 
        title="Confirm Action"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Are you sure you want to {confirmModal.action} this technician?
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button" 
              onClick={() => setConfirmModal({ isOpen: false, action: '', onConfirm: null })}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors"
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
