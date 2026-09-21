import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Activity, Server, Shield, Check, Trash2, Cpu, Sparkles, Layers, Plus, BookOpen, UserCheck, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '../../services/api';

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E8D8CF',
  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  // User creation modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('faculty');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [uRes, cRes, sRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/classes'),
        api.get('/api/admin/stats')
      ]);
      setUsers(uRes.data || []);
      setClasses(cRes.data || []);
      setStats(sRes.data || null);
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 4000);
  };

  const handleDeleteUser = async (id, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"?`)) return;
    try {
      await api.delete(`/api/admin/users/${id}`);
      showNotification(`User "${userName}" deleted successfully.`);
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleRoleChange = async (id, newRoleValue, userName) => {
    try {
      await api.put(`/api/admin/users/${id}`, { role: newRoleValue });
      showNotification(`Updated ${userName}'s role to ${newRoleValue.toUpperCase()}`);
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return;
    setCreatingUser(true);
    try {
      await api.post('/api/admin/users', {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole
      });
      setShowUserModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      showNotification(`User ${newName} (${newRole}) created successfully.`);
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const facultyCount = users.filter((u) => u.role === 'faculty').length;
  const studentCount = users.filter((u) => u.role === 'student').length;

  const kpis = [
    { 
      label: 'Live Users', 
      value: users.length, 
      icon: Users, 
      color: '#FF5A36', 
      bg: '#FFF0EB',
      sub: `${studentCount} Students, ${facultyCount} Faculty`
    },
    { 
      label: 'Class Sections', 
      value: classes.length, 
      icon: Layers, 
      color: '#3B82F6', 
      bg: '#EFF6FF',
      sub: 'Assigned by Administrator'
    },
    { 
      label: 'Active Teachers', 
      value: facultyCount, 
      icon: UserCheck, 
      color: '#10B981', 
      bg: '#ECFDF5',
      sub: 'Teaching assigned classes'
    },
    { 
      label: 'Platform Engine', 
      value: 'Online', 
      icon: Activity, 
      color: '#8B5CF6', 
      bg: '#F5F3FF',
      sub: 'Persistent live storage'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      
      {/* Admin header */}
      <div className="p-6 sm:p-8 rounded-3xl relative overflow-hidden bg-white border border-[#E8D8CF] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5A36]">
            <Sparkles className="h-4 w-4" /> System Administrator Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B18] tracking-tight">
            Academic & User Administration
          </h1>
          <p className="text-[#4A443F] font-medium max-w-xl text-xs sm:text-sm leading-relaxed">
            Assign teachers to classes, manage live user roles (Student, Faculty, Admin), and oversee real database cohorts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-2xl border border-[#E8D8CF] bg-[#FFF9F6] text-[#1E1B18] text-xs font-bold hover:bg-[#FFF0EB] transition-all flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <button
            onClick={() => navigate('/admin/classes')}
            className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md"
          >
            <Layers className="h-4 w-4" /> Manage Classes & Teachers
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <Check className="h-4 w-4 text-emerald-600" />
          {actionMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {kpis.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="p-5 rounded-3xl flex items-center gap-4" style={cardStyle}>
            <div className="p-3.5 rounded-2xl shrink-0" style={{ background: bg }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#786F68]">{label}</p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-0.5 text-[#1E1B18]">{value}</p>
              <p className="text-[11px] text-[#786F68] font-medium mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Class & Teacher Assignment Overview */}
      <div className="p-6 sm:p-8 rounded-3xl space-y-4" style={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F3E8E2] pb-4">
          <div>
            <h2 className="text-base font-black flex items-center gap-2 text-[#1E1B18]">
              <Layers className="h-5 w-5 text-[#FF5A36]" /> Academic Class Sections & Teacher Assignments
            </h2>
            <p className="text-xs text-[#4A443F] mt-1">
              Classes created and assigned to faculty instructors by the Admin.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/classes')}
            className="px-4 py-2 rounded-xl bg-[#FFF9F6] border border-[#E8D8CF] text-xs font-bold text-[#1E1B18] hover:bg-[#FFF0EB] transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5 text-[#FF5A36]" /> Create / Assign Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#FFF9F6] border border-dashed border-[#E8D8CF] text-center space-y-2">
            <Layers className="h-8 w-8 text-[#FF5A36] mx-auto opacity-50" />
            <p className="text-xs font-bold text-[#1E1B18]">No Academic Classes Created Yet</p>
            <p className="text-[11px] text-[#786F68] max-w-md mx-auto">
              Classes and teaching sections must be assigned by the Administrator. Click below to create your first class and assign a faculty member.
            </p>
            <button
              onClick={() => navigate('/admin/classes')}
              className="mt-2 px-4 py-2 rounded-xl bg-[#FF5A36] text-white text-xs font-bold hover:bg-[#E04826] transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Assign First Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {classes.map((cls) => (
              <div key={cls.id} className="p-4 rounded-2xl border border-[#E8D8CF] bg-[#FFF9F6] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-[#FF5A36] bg-[#FFF0EB] border border-[#FFE4D9]">
                    {cls.code}
                  </span>
                  <span className="text-[11px] text-[#786F68] font-bold">
                    {cls.student_count || 0} Students
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E1B18]">{cls.name}</h4>
                  <p className="text-[11px] text-[#4A443F] mt-0.5 line-clamp-1">{cls.description || 'General curriculum section'}</p>
                </div>
                <div className="pt-2 border-t border-[#E8D8CF] flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold uppercase text-[#786F68]">Teacher:</span>
                  <span className="font-extrabold text-[#1E1B18]">
                    {cls.faculty_name && cls.faculty_name !== 'Unassigned' ? cls.faculty_name : (
                      <span className="text-amber-600 font-bold">Needs Teacher</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live User Management Table */}
      <div className="p-6 sm:p-8 rounded-3xl space-y-6" style={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black flex items-center gap-2 text-[#1E1B18]">
              <Users className="h-5 w-5 text-[#FF5A36]" /> Live System User Directory ({users.length})
            </h2>
            <p className="text-xs mt-1 text-[#4A443F]">
              Actual user accounts registered in the database. Change roles or remove accounts in real time.
            </p>
          </div>
          <button
            onClick={() => setShowUserModal(true)}
            className="px-4 py-2 rounded-xl bg-[#FF5A36] text-white text-xs font-bold hover:bg-[#E04826] transition-all flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Provision New User
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs text-[#1E1B18]">
            <thead>
              <tr className="border-b border-[#F3E8E2] text-[#786F68] text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3">User Name</th>
                <th className="py-3">Email Address</th>
                <th className="py-3">Role / Permissions</th>
                <th className="py-3">Joined Date</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8E2]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FFF9F6] transition-all">
                  <td className="py-3.5 font-bold text-[#1E1B18] flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-xl bg-[#FFF0EB] text-[#FF5A36] font-extrabold flex items-center justify-center text-xs border border-[#FFE4D9]">
                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span>{u.name}</span>
                  </td>
                  <td className="py-3.5 text-[#4A443F] font-medium">{u.email}</td>
                  <td className="py-3.5">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value, u.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none transition-all ${
                        u.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : u.role === 'faculty'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-[#FFF0EB] text-[#FF5A36] border-[#FFE4D9]'
                      }`}
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty / Teacher</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                  <td className="py-3.5 text-[#786F68] font-medium">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      title="Delete User"
                      className="p-2 rounded-xl text-[#786F68] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all focus:outline-none"
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

      {/* Provision User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Provision System User</h2>
              <button onClick={() => setShowUserModal(false)} className="text-[#786F68] hover:text-[#1E1B18] text-xs font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="teacher@school.edu"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                >
                  <option value="faculty">Faculty / Teacher</option>
                  <option value="student">Student</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
