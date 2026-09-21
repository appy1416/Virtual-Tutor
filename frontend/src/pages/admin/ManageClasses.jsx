import React, { useState, useEffect } from 'react';
import { Layers, Plus, Users, Trash2, Edit, Check, X, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

const ManageClasses = () => {
  const [classes, setClasses] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [studentUsers, setStudentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const fetchData = async () => {
    try {
      const [cRes, uRes] = await Promise.all([
        api.get('/api/classes'),
        api.get('/api/admin/users')
      ]);
      setClasses(cRes.data || []);
      const users = uRes.data || [];
      const faculties = users.filter((u) => u.role === 'faculty');
      const students = users.filter((u) => u.role === 'student');
      setFacultyUsers(faculties);
      setStudentUsers(students);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingClass(null);
    setName('');
    setCode('');
    setDescription('');
    setFacultyId('');
    setSelectedStudentIds([]);
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingClass(c);
    setName(c.name || '');
    setCode(c.code || '');
    setDescription(c.description || '');
    setFacultyId(c.faculty_id || '');
    const currentStudentIds = c.student_ids || [];
    setSelectedStudentIds(currentStudentIds.map(id => typeof id === 'object' ? id.id || String(id) : String(id)));
    setShowModal(true);
  };

  const handleStudentToggle = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !code) return;
    setSubmitting(true);

    try {
      const payload = {
        name,
        code,
        description,
        faculty_id: facultyId || null,
        student_ids: selectedStudentIds
      };

      if (editingClass) {
        await api.put(`/api/classes/${editingClass.id}`, payload);
      } else {
        await api.post('/api/classes', payload);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving class section');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (classId) => {
    if (!window.confirm('Are you sure you want to delete this class section?')) return;
    try {
      await api.delete(`/api/classes/${classId}`);
      fetchData();
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
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Manage Academic Classes</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Create sections, assign faculty instructors, and manage student rosters.</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create Class Section
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((c) => (
          <div key={c.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-4 shadow-sm hover:border-[#FF5A36] transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black text-[#FF5A36] bg-[#FFF0EB] border border-[#FFE4D9]">
                  {c.code}
                </span>
                <span className="text-xs text-[#4A443F] font-bold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#FF5A36]" /> {c.student_count || 0} Students
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#1E1B18]">{c.name}</h3>
                <p className="text-xs text-[#4A443F] mt-1 leading-relaxed">{c.description || 'No description provided'}</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] text-xs space-y-1">
                <p className="text-[10px] uppercase font-bold text-[#786F68]">Assigned Faculty</p>
                <p className="font-extrabold text-[#1E1B18]">{c.faculty_name || 'No Faculty Assigned'}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F3E8E2] flex items-center justify-end gap-2">
              <button
                onClick={() => openEditModal(c)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E8D8CF] bg-[#FFF9F6] text-[#1E1B18] text-xs font-bold hover:bg-[#FFF0EB] transition-all flex items-center gap-1.5"
              >
                <Edit className="h-3.5 w-3.5" /> Edit Section
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="p-2 rounded-xl text-[#786F68] hover:text-rose-600 hover:bg-rose-50 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Class Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">
                {editingClass ? 'Edit Class Section' : 'Create Class Section'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Class Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS 301: Advanced Algorithms"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Section Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-301-A"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Section overview or syllabus scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Assign Faculty Instructor</label>
                <select
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                >
                  <option value="">-- Select Faculty Member --</option>
                  {facultyUsers.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                  ))}
                </select>
                {facultyUsers.length === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl mt-1.5 border border-amber-200">
                    No faculty accounts registered yet. You can promote any user to Faculty in Manage Users or provision a new teacher.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#4A443F]">Enroll Students ({selectedStudentIds.length} Selected)</label>
                  {studentUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedStudentIds.length === studentUsers.length) {
                          setSelectedStudentIds([]);
                        } else {
                          setSelectedStudentIds(studentUsers.map((s) => s.id));
                        }
                      }}
                      className="text-[10px] font-bold text-[#FF5A36] hover:underline"
                    >
                      {selectedStudentIds.length === studentUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto border border-[#E8D8CF] bg-[#FFF9F6] rounded-2xl p-3 space-y-1.5 divide-y divide-[#F3E8E2]">
                  {studentUsers.map((s) => {
                    const isChecked = selectedStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleStudentToggle(s.id)}
                        className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-white"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#1E1B18]">{s.name}</p>
                          <p className="text-[10px] text-[#786F68]">{s.email}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-lg border flex items-center justify-center ${
                          isChecked ? 'bg-[#FF5A36] border-[#FF5A36] text-white' : 'border-[#E8D8CF] bg-white'
                        }`}>
                          {isChecked && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {submitting ? 'Saving...' : (editingClass ? 'Update Class' : 'Create Class')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClasses;
