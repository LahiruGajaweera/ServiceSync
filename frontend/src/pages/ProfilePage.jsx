import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [saving, setSaving] = useState(false);
  const [performance, setPerformance] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user?.role === 'technician') {
      const fetchPerformance = async () => {
        try {
          const res = await api.get('/users/me/performance');
          setPerformance(res.data);
        } catch (err) {
          console.error("Failed to fetch performance", err);
        }
      };
      fetchPerformance();
    }
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingAvatar(true);
    try {
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(res.data);
    } catch (err) {
      console.error("Failed to upload avatar", err);
      // Optional: show a toast or alert
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setStatus({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    
    setSaving(true);
    setStatus(null);
    try {
      await api.post('/auth/update-password', { new_password: newPassword });
      setStatus({ type: 'success', message: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.detail || 'Failed to update password.' });
    } finally {
      setSaving(false);
    }
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  const getRatingColor = (rating) => {
    if (rating === 'Excellent') return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800/50';
    if (rating === 'Good') return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50';
    return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50';
  };

  const getRatingStrokeColor = (rating) => {
    if (rating === 'Excellent') return 'text-green-500 dark:text-green-400';
    if (rating === 'Good') return 'text-blue-500 dark:text-blue-400';
    return 'text-amber-500 dark:text-amber-400';
  };

  return (
    <div className="min-h-full bg-white dark:bg-gray-900 p-8 flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Page Title & Performance Badge */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account details and security settings.</p>
          </div>
          
          {user?.role === 'technician' && performance && (
            <div className="relative group overflow-hidden flex items-center gap-5 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/80 p-3 pr-6 rounded-2xl border border-gray-200/60 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
              {/* Background Glow */}
              <div className={`absolute -inset-2 opacity-20 blur-xl transition-opacity duration-500 group-hover:opacity-40 ${getRatingStrokeColor(performance.rating).replace(/text-/g, 'bg-')}`}></div>
              
              <div className="relative flex items-center justify-center w-14 h-14 bg-white dark:bg-gray-900 rounded-full shadow-inner p-1">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 36 36">
                  <path className="text-gray-100 dark:text-gray-800" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className={`${getRatingStrokeColor(performance.rating)} transition-all duration-1500 ease-out`} strokeDasharray={`${performance.performance_score}, 100`} strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-gray-900 dark:text-white">{performance.performance_score}</span>
                </div>
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className={`w-3.5 h-3.5 ${getRatingStrokeColor(performance.rating)}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <p className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Rating</p>
                </div>
                <div className={`text-base font-black tracking-wide ${getRatingStrokeColor(performance.rating)} drop-shadow-sm`}>
                  {performance.rating}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          
          {/* Left Column (Profile & Contact) */}
          <div className="lg:col-span-5 flex flex-col gap-8 h-full">
            
            {/* Avatar & Name */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center text-center flex-1 min-h-[250px]">
              <div 
                className="relative group cursor-pointer mb-6"
                onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange} 
                />
                
                <div className="w-32 h-32 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-5xl font-bold border-4 border-white dark:border-gray-800 transition-colors group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 shadow-md">
                  {user?.avatar_url ? (
                    <img 
                      src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${user.avatar_url}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    userInitial
                  )}
                </div>
                
                <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 transition-opacity ${uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {uploadingAvatar ? (
                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
              </div>

              
              <div className="w-full">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{user?.name}</h2>
                <p className="text-gray-500 dark:text-gray-400 truncate flex items-center justify-center gap-2 mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {user?.email || 'N/A'}
                </p>
                <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                  {user?.role}
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 flex-1 flex flex-col justify-center">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-widest">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Contact Information
              </h3>
              <div className="space-y-4">
                {user?.phone_number ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Phone Number</label>
                    <div className="text-gray-900 dark:text-gray-200 text-lg font-medium">{user.phone_number}</div>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No additional contact info</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Column (Security) */}
          <div className="lg:col-span-7 h-full">
            <div className="bg-white dark:bg-gray-800/30 rounded-3xl p-8 md:p-12 border border-gray-200 dark:border-gray-700 h-full flex flex-col justify-center shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                Security Settings
              </h3>

              {user?.is_temporary_password && (
                <div className="mb-10 p-5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-4">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0">
                    <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-bold text-amber-900 dark:text-amber-200">Action Required</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-1.5 leading-relaxed">You are currently using a temporary password. Please set a new permanent password below to secure your account.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-8 max-w-lg">
                {status && (
                  <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${status.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800/50' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800/50'}`}>
                    {status.type === 'success' ? (
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                    <span className="font-medium">{status.message}</span>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all shadow-sm"
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all shadow-sm"
                      placeholder="Re-enter new password"
                    />
                  </div>
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-3.5 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                  >
                    {saving && (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {saving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
