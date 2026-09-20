import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function TechProfileModal({ open, onClose }) {
  const { user, login } = useAuth(); // login function might update the token if needed, or we just rely on state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [saving, setSaving] = useState(false);

  if (!open) return null;

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
      // The backend endpoint is POST /auth/update-password
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">My Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* User Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
              <div className="text-gray-900 dark:text-white font-medium">{user?.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Email</label>
              <div className="text-gray-900 dark:text-white font-medium">{user?.email || 'N/A'}</div>
            </div>
            {user?.phone_number && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Phone Number</label>
                <div className="text-gray-900 dark:text-white font-medium">{user.phone_number}</div>
              </div>
            )}
            
            {user?.is_temporary_password && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg mt-2">
                You are currently using a temporary password. Please set a new password below to secure your account.
              </div>
            )}
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Update Password */}
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Change Password</h4>
            
            {status && (
              <div className={`text-sm px-3 py-2 rounded-lg ${status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {status.message}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Re-enter new password"
              />
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
