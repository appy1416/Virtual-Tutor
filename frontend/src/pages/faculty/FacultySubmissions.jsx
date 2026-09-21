import React, { useState, useEffect } from 'react';
import { FolderCheck, Award, FileText, CheckCircle2, User, Send, BookOpen, CheckSquare, X } from 'lucide-react';
import api from '../../services/api';

const FacultySubmissions = () => {
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'quizzes'
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGradingSub, setActiveGradingSub] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  // Quiz Attempts State
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [activeGradingQuizAttempt, setActiveGradingQuizAttempt] = useState(null);

  useEffect(() => {
    fetchAssignments();
    fetchQuizAttempts();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/api/assignments');
      setAssignments(res.data || []);
      if (res.data?.length > 0) {
        setSelectedAssignment(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizAttempts = async () => {
    try {
      const res = await api.get('/api/quiz/faculty/attempts');
      setQuizAttempts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubmissions = async (asgId) => {
    if (!asgId) return;
    try {
      const res = await api.get(`/api/assignments/${asgId}/submissions`);
      setSubmissions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedAssignment) {
      fetchSubmissions(selectedAssignment.id);
    }
  }, [selectedAssignment]);

  const handleGradeSubmission = async (e) => {
    e.preventDefault();
    if (!activeGradingSub || marks === '') return;
    setGrading(true);

    try {
      await api.post(`/api/assignments/submissions/${activeGradingSub.id}/grade`, {
        marks: parseFloat(marks),
        feedback
      });
      setActiveGradingSub(null);
      setMarks('');
      setFeedback('');
      fetchSubmissions(selectedAssignment.id);
    } catch (err) {
      console.error(err);
    } finally {
      setGrading(false);
    }
  };

  const handleGradeQuizAttempt = async (e) => {
    e.preventDefault();
    if (!activeGradingQuizAttempt || marks === '') return;
    setGrading(true);

    try {
      await api.post(`/api/quiz/faculty/attempts/${activeGradingQuizAttempt.id}/grade`, {
        score: parseFloat(marks),
        feedback
      });
      setActiveGradingQuizAttempt(null);
      setMarks('');
      setFeedback('');
      fetchQuizAttempts();
    } catch (err) {
      console.error(err);
    } finally {
      setGrading(false);
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
            <FolderCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Review & Grade Submissions</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Review student homework submissions and quiz attempts, assign marks, and provide constructive feedback.</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="p-1 rounded-2xl bg-white border border-[#E8D8CF] flex gap-1 shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'assignments' 
                ? 'bg-[#FF5A36] text-white shadow-md' 
                : 'text-[#4A443F] hover:text-[#1E1B18]'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Homework Submissions
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'quizzes' 
                ? 'bg-[#FF5A36] text-white shadow-md' 
                : 'text-[#4A443F] hover:text-[#1E1B18]'
            }`}
          >
            <Award className="h-3.5 w-3.5" /> Quiz Attempts ({quizAttempts.length})
          </button>
        </div>
      </div>

      {activeTab === 'assignments' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Select Assignment Column */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-xs font-bold text-[#4A443F] uppercase tracking-wider">Assignments ({assignments.length})</h2>
            {assignments.length === 0 ? (
              <p className="text-xs italic text-[#786F68] p-4 bg-white rounded-2xl border border-[#E8D8CF]">No assignments published yet.</p>
            ) : (
              assignments.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelectedAssignment(a)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1 ${
                    selectedAssignment?.id === a.id
                      ? 'bg-[#FFF0EB] border-[#FF5A36] text-[#1E1B18] shadow-sm'
                      : 'bg-white border-[#E8D8CF] text-[#4A443F] hover:border-[#FF5A36]'
                  }`}
                >
                  <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2 py-0.5 rounded-full">{a.class_name || 'Assignment'}</span>
                  <h3 className="text-xs font-extrabold text-[#1E1B18]">{a.title}</h3>
                  <p className="text-[10px] text-[#786F68] font-bold">Submissions: {a.submission_count || 0}</p>
                </div>
              ))
            )}
          </div>

          {/* Submissions List Column */}
          <div className="lg:col-span-2 space-y-4">
            {selectedAssignment ? (
              <>
                <div className="p-5 rounded-3xl border border-[#E8D8CF] bg-white flex items-center justify-between shadow-sm">
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E1B18]">{selectedAssignment.title}</h3>
                    <p className="text-xs text-[#4A443F]">Total Marks: <strong className="text-[#FF5A36]">{selectedAssignment.total_marks}</strong></p>
                  </div>
                  <span className="text-xs font-bold text-[#FF5A36] bg-[#FFF0EB] px-3 py-1 rounded-full border border-[#FFE4D9]">
                    {submissions.length} Student Submissions
                  </span>
                </div>

                {submissions.length === 0 ? (
                  <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center text-xs font-semibold text-[#786F68] shadow-sm">
                    No submissions received for this assignment yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((s) => (
                      <div key={s.id} className="p-5 rounded-3xl border border-[#E8D8CF] bg-white space-y-3 shadow-sm hover:border-[#FF5A36] transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-[#FF5A36] text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                              {s.student_name ? s.student_name.charAt(0) : 'S'}
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-[#1E1B18]">{s.student_name}</h4>
                              <p className="text-[10px] text-[#786F68] font-medium">{s.student_email}</p>
                            </div>
                          </div>

                          {s.status === 'Graded' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <Award className="h-3.5 w-3.5" /> Graded: {s.marks_obtained} pts
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Needs Grading
                            </span>
                          )}
                        </div>

                        {s.notes && (
                          <p className="text-xs text-[#1E1B18] bg-[#FFF9F6] p-3 rounded-2xl border border-[#E8D8CF] font-medium leading-relaxed">
                            {s.notes}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-[#F3E8E2] text-xs">
                          {s.file_url ? (
                            <div className="flex items-center gap-3">
                              <a
                                href={`http://localhost:8000/api/assignments/submissions/${s.id}/download`}
                                download={`${s.student_name ? s.student_name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'submission'}.pdf`}
                                className="px-3 py-1.5 rounded-xl bg-[#FFF9F6] border border-[#E8D8CF] text-[#FF5A36] hover:bg-[#FFF0EB] transition-all flex items-center gap-1.5 text-xs font-bold"
                                title="Download Genuine PDF Document"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Download PDF ({s.file_name || 'Document'})</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#786F68]">No file attached</span>
                          )}

                          <button
                            onClick={() => {
                              setActiveGradingSub(s);
                              setMarks(s.marks_obtained || '');
                              setFeedback(s.feedback || '');
                            }}
                            className="px-4 py-2 rounded-xl bg-[#FF5A36] hover:bg-[#E04826] text-white text-xs font-extrabold transition-all shadow-md"
                          >
                            {s.status === 'Graded' ? 'Edit Grade' : 'Grade Submission'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center text-xs font-semibold text-[#786F68] shadow-sm">
                Select an assignment on the left to review student submissions.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Quiz Attempts View */
        <div className="space-y-4">
          {quizAttempts.length === 0 ? (
            <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center text-xs font-semibold text-[#786F68] shadow-sm">
              No student quiz attempts recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizAttempts.map((qa) => (
                <div key={qa.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-3 shadow-sm hover:border-[#FF5A36] transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-[#1E1B18]">{qa.quiz_title || 'Faculty Quiz'}</h3>
                      <p className="text-xs text-[#4A443F]">Student: <strong className="text-[#1E1B18]">{qa.student_name}</strong></p>
                    </div>
                    {qa.status === 'Graded' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" /> Score: {qa.score}/{qa.total_marks}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Score: {qa.score}/{qa.total_marks} (Needs Review)
                      </span>
                    )}
                  </div>

                  {qa.feedback && (
                    <p className="text-xs text-[#1E1B18] bg-[#FFF9F6] p-3 rounded-2xl border border-[#E8D8CF] font-medium">
                      Feedback: {qa.feedback}
                    </p>
                  )}

                  <div className="flex items-center justify-end pt-3 border-t border-[#F3E8E2]">
                    <button
                      onClick={() => {
                        setActiveGradingQuizAttempt(qa);
                        setMarks(qa.score || '');
                        setFeedback(qa.feedback || '');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#FF5A36] hover:bg-[#E04826] text-white text-xs font-extrabold transition-all shadow-md"
                    >
                      {qa.status === 'Graded' ? 'Edit Quiz Grade' : 'Review & Grade Quiz'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assignment Grading Modal */}
      {activeGradingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Grade Submission: {activeGradingSub.student_name}</h2>
              <button onClick={() => setActiveGradingSub(null)} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGradeSubmission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Marks Obtained (Out of {selectedAssignment?.total_marks})</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  max={selectedAssignment?.total_marks || 100}
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Feedback & Comments</label>
                <textarea
                  rows={3}
                  placeholder="Great work! Excellent submission..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setActiveGradingSub(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={grading}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {grading ? 'Saving...' : 'Submit Grade & Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiz Attempt Grading Modal */}
      {activeGradingQuizAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Grade Quiz: {activeGradingQuizAttempt.student_name}</h2>
              <button onClick={() => setActiveGradingQuizAttempt(null)} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGradeQuizAttempt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Final Score (Out of {activeGradingQuizAttempt.total_marks})</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  max={activeGradingQuizAttempt.total_marks || 100}
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Feedback & Recommendations</label>
                <textarea
                  rows={3}
                  placeholder="Well done on MCQ section. Review concept X..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setActiveGradingQuizAttempt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={grading}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {grading ? 'Saving...' : 'Save Grade & Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultySubmissions;
