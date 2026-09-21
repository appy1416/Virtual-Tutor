import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, FileText, Calendar, Users, Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../../services/api';

const FacultyAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [classId, setClassId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [file, setFile] = useState(null);

  const fetchData = async () => {
    try {
      const [asgRes, clsRes, subRes] = await Promise.all([
        api.get('/api/assignments'),
        api.get('/api/classes'),
        api.get('/api/subjects')
      ]);
      setAssignments(asgRes.data || []);
      setClasses(clsRes.data || []);
      setSubjects(subRes.data || []);
      if (clsRes.data?.length > 0) setClassId(clsRes.data[0].id);
      if (subRes.data?.length > 0) setSubjectId(subRes.data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    const fetchTopics = async () => {
      try {
        const res = await api.get(`/api/subjects/${subjectId}/topics`);
        setTopics(res.data || []);
        if (res.data?.length > 0) setTopicId(res.data[0].id);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTopics();
  }, [subjectId]);

  useEffect(() => {
    if (classes.length > 0 && (!classId || !classes.some(c => c.id === classId))) {
      setClassId(classes[0].id);
    }
  }, [classes, showModal]);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const activeClassId = classId || (classes.length > 0 ? classes[0].id : '');

    if (!activeClassId) {
      setFeedbackMsg({ type: 'error', text: 'No class section selected or assigned to you.' });
      return;
    }

    if (!title || !description || !subjectId || !topicId || !dueDate) return;
    setCreating(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('subject_id', subjectId);
    formData.append('topic_id', topicId);
    formData.append('subtopic', subtopic || '');
    formData.append('class_id', activeClassId);
    formData.append('due_date', dueDate);
    formData.append('total_marks', totalMarks);
    if (file) formData.append('file', file);

    try {
      await api.post('/api/assignments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFeedbackMsg({ type: 'success', text: 'Assignment published successfully.' });
      setTimeout(() => {
        setShowModal(false);
        setFeedbackMsg(null);
        setTitle('');
        setDescription('');
        setSubtopic('');
        setDueDate('');
        setFile(null);
        fetchData();
      }, 1200);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to publish assignment.' });
    } finally {
      setCreating(false);
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <CheckSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Class Assignments</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Create homework assignments and notify enrolled section students.</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setFeedbackMsg(null); }}
          className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create Assignment
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <CheckSquare className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Assignments Created</h3>
          <p className="text-xs text-[#4A443F]">Click Create Assignment to assign homework to your section.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assignments.map((a) => (
            <div key={a.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-3 shadow-sm hover:border-[#FF5A36] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-1 rounded-full border border-[#FFE4D9]">
                  Target Class: {a.class_name || 'Assigned Section'}
                </span>
                <span className="text-xs text-[#4A443F] font-bold">Submissions: {a.submission_count || 0}</span>
              </div>
              <h3 className="text-base font-extrabold text-[#1E1B18]">{a.title}</h3>
              <p className="text-xs sm:text-sm text-[#4A443F] font-medium leading-relaxed">{a.description}</p>
              <div className="pt-3 border-t border-[#F3E8E2] flex items-center justify-between text-xs text-[#4A443F]">
                <span>Due Date: <strong className="text-[#1E1B18]">{a.due_date}</strong></span>
                <span>Total Marks: <strong className="text-[#FF5A36] font-extrabold">{a.total_marks}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Create New Assignment</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {feedbackMsg && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                feedbackMsg.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                {feedbackMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateAssignment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Target Class</label>
                {classes.length === 0 ? (
                  <p className="text-xs text-amber-800 font-bold bg-amber-50 p-3 rounded-2xl border border-amber-200">
                    No classes assigned to you. Contact Admin to assign teaching sections.
                  </p>
                ) : (
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) — {c.student_count || 0} Students
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment 1 - SQL Queries & Normalization"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide detailed homework instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Topic</label>
                  <select
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Total Marks</label>
                  <input
                    type="number"
                    required
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Attachment File (Optional PDF/DOCX)</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-xs text-[#1E1B18] cursor-pointer"
                />
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
                  {creating ? 'Publishing...' : 'Publish Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAssignments;
