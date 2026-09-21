import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Trash2, Edit, CheckCircle, XCircle, X } from 'lucide-react';
import api from '../../services/api';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setCreating(true);

    try {
      await api.post('/api/admin/users', { name, email, password, role });
      setShowModal(false);
      setName('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user account?')) return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">User Account Management</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Provision accounts, assign roles (Student, Faculty, Admin), and manage active user access.</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create User Account
        </button>
      </div>

      <div className="rounded-3xl border border-[#E8D8CF] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E1B18]">
            <thead className="bg-[#FFF9F6] text-[#786F68] font-bold uppercase border-b border-[#E8D8CF] text-[10px]">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Joined Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8E2]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FFF9F6] transition-all">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#FF5A36] text-white font-black text-xs flex items-center justify-center shadow-sm">
                      {u.name ? u.name.charAt(0) : 'U'}
                    </div>
                    <div>
                      <p className="font-extrabold text-[#1E1B18] text-sm">{u.name}</p>
                      <p className="text-[11px] text-[#786F68] font-medium">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 capitalize font-bold">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9]">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#786F68] text-xs font-medium">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 rounded-xl text-[#786F68] hover:text-rose-600 hover:bg-rose-50 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Create User Account</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="sarah@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty / Teacher</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {creating ? 'Creating...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
