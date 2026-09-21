import React, { useState, useEffect } from 'react';
import { CheckSquare, Upload, Calendar, Clock, FileText, CheckCircle, AlertCircle, Award, X, Download } from 'lucide-react';
import api from '../../services/api';

const StudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/api/assignments');
      setAssignments(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleSubmitHomework = async (e) => {
    e.preventDefault();
    if (!activeModal) return;
    setSubmitError('');

    if (file && file.size > 25 * 1024 * 1024) {
      setSubmitError('File size exceeds 25MB limit. Please choose a smaller file.');
      return;
    }

    if (!notes.trim() && !file) {
      setSubmitError('Please provide either solution notes or attach a PDF file.');
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append('notes', notes);
    if (file) {
      formData.append('file', file);
    }

    try {
      await api.post(`/api/assignments/${activeModal.id}/submit`, formData);
      setActiveModal(null);
      setNotes('');
      setFile(null);
      setSubmitError('');
      fetchAssignments();
    } catch (err) {
      console.error(err);
      setSubmitError(err.response?.data?.detail || 'Failed to submit assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status, submission) => {
    const marks = submission?.marks_obtained ?? null;
    if (status === 'Graded' || marks !== null) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-sm">
          <Award className="h-3.5 w-3.5 text-emerald-600" /> Graded: {marks} pts
        </span>
      );
    }
    if (status === 'Submitted' || submission) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9] flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5" /> Submitted
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> Pending Submission
      </span>
    );
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
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <CheckSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E1B18]">Course Assignments</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">View class homework, submit attachments, and check faculty feedback.</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <CheckSquare className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Assignments Found</h3>
          <p className="text-xs text-[#4A443F]">Your faculty has not assigned any homework yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assignments.map((a) => (
            <div key={a.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm hover:border-[#FF5A36] transition-all space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-0.5 rounded-full border border-[#FFE4D9]">
                      {a.class_name || 'Class Homework'}
                    </span>
                    <span className="text-xs text-[#786F68]">Faculty: <strong className="text-[#1E1B18]">{a.faculty_name || 'Teacher'}</strong></span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#1E1B18] mt-1.5">{a.title}</h3>
                </div>
                {getStatusBadge(a.status, a.submission)}
              </div>

              <p className="text-xs sm:text-sm text-[#4A443F] font-medium whitespace-pre-wrap leading-relaxed">{a.description}</p>

              {/* Student Submission Card */}
              {a.submission && (
                <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-[#1E1B18]">Submission Status:</span>
                      {a.submission.marks_obtained !== null && a.submission.marks_obtained !== undefined ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-200 flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-emerald-600" />
                          Graded Score: {a.submission.marks_obtained} / {a.total_marks} ({Math.round((a.submission.marks_obtained / a.total_marks) * 100)}%)
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-bold">Submitted — Awaiting Instructor Evaluation</span>
                      )}
                    </div>

                    <a
                      href={`http://localhost:8000/api/assignments/submissions/${a.submission.id}/download`}
                      download="my_submission.pdf"
                      className="text-xs font-bold text-[#FF5A36] hover:underline flex items-center gap-1"
                      title="Download Solution PDF"
                    >
                      <Download className="h-3.5 w-3.5" /> Download My Submission (PDF)
                    </a>
                  </div>

                  {a.submission.notes && (
                    <p className="text-xs text-[#4A443F] bg-white p-2.5 rounded-xl border border-[#E8D8CF]">
                      <strong>Notes:</strong> {a.submission.notes}
                    </p>
                  )}

                  {a.submission.feedback && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-0.5">
                      <p className="font-extrabold text-emerald-900">Faculty Feedback:</p>
                      <p className="text-[#1E1B18] font-semibold">{a.submission.feedback}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F3E8E2] text-xs">
                <div className="flex items-center gap-4 text-[#4A443F]">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Calendar className="h-4 w-4 text-[#FF5A36]" /> Due: <strong className="text-[#1E1B18]">{a.due_date}</strong>
                  </span>
                  <span className="text-xs font-semibold">Total Marks: <strong className="text-[#FF5A36] font-extrabold">{a.total_marks}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  {a.attachment_url && (
                    <a
                      href={`http://localhost:8000/api/assignments/${a.id}/download-attachment`}
                      download="assignment_instructions.pdf"
                      className="px-4 py-2 rounded-xl text-xs font-bold text-[#1E1B18] bg-[#FFF9F6] border border-[#E8D8CF] hover:bg-[#FFF0EB] transition-all flex items-center gap-1.5"
                    >
                      <Download className="h-4 w-4 text-[#FF5A36]" /> Download Prompt (PDF)
                    </a>
                  )}

                  {a.status !== 'Graded' && (
                    <button
                      onClick={() => setActiveModal(a)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF5A36] hover:bg-[#E04826] transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Upload className="h-4 w-4" />
                      {a.status === 'Submitted' ? 'Resubmit Solution' : 'Submit Homework'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submission Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Submit Homework: {activeModal.title}</h2>
              <button onClick={() => { setActiveModal(null); setSubmitError(''); }} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitHomework} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1.5">Solution Notes / Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your solution or write notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3.5 text-xs font-semibold text-[#1E1B18] placeholder-[#786F68] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1.5">Attach Solution Document (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-xs text-[#1E1B18] file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FF5A36] file:text-white hover:file:bg-[#E04826] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all disabled:opacity-50 shadow-md"
                >
                  {submitting ? 'Submitting...' : 'Upload & Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAssignments;
