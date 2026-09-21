import React, { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Clock, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../../services/api';

const FacultyQuizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questions, setQuestions] = useState([
    { id: 'q1', type: 'mcq', question_text: '', options: ['', '', '', ''], correct_answer: '0', marks: 1 }
  ]);

  const fetchData = async () => {
    try {
      const [qRes, cRes, sRes] = await Promise.all([
        api.get('/api/quiz/faculty/list'),
        api.get('/api/classes'),
        api.get('/api/subjects')
      ]);
      setQuizzes(qRes.data || []);
      setClasses(cRes.data || []);
      setSubjects(sRes.data || []);
      if (cRes.data?.length > 0) setClassId(cRes.data[0].id);
      if (sRes.data?.length > 0) setSubjectId(sRes.data[0].id);
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

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { id: `q${prev.length + 1}`, type: 'mcq', question_text: '', options: ['', '', '', ''], correct_answer: '0', marks: 1 }
    ]);
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].options[optIndex] = value;
      return updated;
    });
  };

  useEffect(() => {
    if (classes.length > 0 && (!classId || !classes.some(c => c.id === classId))) {
      setClassId(classes[0].id);
    }
  }, [classes, showModal]);

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const activeClassId = classId || (classes.length > 0 ? classes[0].id : '');

    if (!activeClassId) {
      setFeedbackMsg({ type: 'error', text: 'No class section selected or assigned to you.' });
      return;
    }

    if (!title || !subjectId || !topicId || questions.length === 0) return;
    setCreating(true);

    try {
      await api.post('/api/quiz/faculty/create', {
        title,
        subject_id: subjectId,
        topic_id: topicId,
        class_id: activeClassId,
        duration_minutes: durationMinutes,
        questions
      });
      setFeedbackMsg({ type: 'success', text: 'Quiz published successfully.' });
      setTimeout(() => {
        setShowModal(false);
        setFeedbackMsg(null);
        setTitle('');
        fetchData();
      }, 1200);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to publish quiz.' });
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
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <Award className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Faculty Manual Quizzes</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Design customized examinations with MCQ, True/False, Short Answer, or Coding questions.</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setFeedbackMsg(null); }}
          className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Create Manual Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <Award className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Manual Quizzes Published</h3>
          <p className="text-xs text-[#4A443F]">Click Create Manual Quiz to author an examination.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((q) => (
            <div key={q.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-3 shadow-sm hover:border-[#FF5A36] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-0.5 rounded-full border border-[#FFE4D9]">
                  {q.duration_minutes} Mins Duration
                </span>
                <span className="text-xs text-[#4A443F] font-bold">Attempts: {q.attempt_count || 0}</span>
              </div>
              <h3 className="text-base font-extrabold text-[#1E1B18]">{q.title}</h3>
              <div className="pt-3 border-t border-[#F3E8E2] flex items-center justify-between text-xs text-[#4A443F]">
                <span>Questions: <strong className="text-[#1E1B18]">{q.questions?.length || 0}</strong></span>
                <span>Total Marks: <strong className="text-[#FF5A36] font-extrabold">{q.total_marks}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Author Manual Quiz</h2>
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

            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Quiz Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-term Assessment: DBMS Normalization"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Class Section</label>
                  {classes.length === 0 ? (
                    <p className="text-xs text-amber-800 font-bold bg-amber-50 p-2 rounded-xl border border-amber-200">
                      No classes assigned.
                    </p>
                  ) : (
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
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
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Question Editor List */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-[#FF5A36] uppercase tracking-wider">Questions ({questions.length})</h3>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9] hover:bg-[#FFE4D9]"
                  >
                    + Add Question
                  </button>
                </div>

                {questions.map((q, idx) => (
                  <div key={idx} className="p-4 sm:p-5 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-extrabold text-[#1E1B18]">Question #{idx + 1}</span>
                      <select
                        value={q.type}
                        onChange={(e) => handleQuestionChange(idx, 'type', e.target.value)}
                        className="bg-white border border-[#E8D8CF] rounded-xl px-3 py-1 text-xs font-bold text-[#FF5A36]"
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="true_false">True / False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                        <option value="coding">Coding Challenge</option>
                      </select>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Question Statement..."
                      value={q.question_text}
                      onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                      className="w-full bg-white border border-[#E8D8CF] rounded-xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                    />

                    {q.type === 'mcq' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <input
                            key={oIdx}
                            type="text"
                            placeholder={`Option ${oIdx + 1}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(idx, oIdx, e.target.value)}
                            className="bg-white border border-[#E8D8CF] rounded-xl px-3 py-2 text-xs font-semibold text-[#1E1B18]"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {creating ? 'Publishing...' : 'Publish Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyQuizzes;
