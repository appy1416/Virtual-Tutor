import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Award, FileQuestion, ArrowRight, BookOpen, Clock, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };

const Quiz = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' or 'ai_practice'
  const [assignedQuizzes, setAssignedQuizzes] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(true);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [questionCount, setQuestionCount] = useState(5);
  const [questionType, setQuestionType] = useState('MCQ');

  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { 
    fetchInitialData(); 
    fetchAssignedQuizzes();
  }, []);

  const fetchAssignedQuizzes = async () => {
    setLoadingAssigned(true);
    try {
      const res = await api.get('/api/quiz/student/assigned');
      setAssignedQuizzes(res.data || []);
    } catch (err) {
      console.error('Failed to fetch assigned quizzes', err);
    } finally {
      setLoadingAssigned(false);
    }
  };

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopics(selectedSubjectId);
    } else {
      setTopics([]);
      setSelectedTopicId('');
      setSubtopics([]);
      setSelectedSubtopic('');
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedTopicId && topics.length > 0) {
      const topicObj = topics.find((t) => t.id === selectedTopicId);
      if (topicObj && topicObj.subtopics) {
        setSubtopics(topicObj.subtopics);
        if (location.state && location.state.prefillSubtopic && topicObj.subtopics.includes(location.state.prefillSubtopic)) {
          setSelectedSubtopic(location.state.prefillSubtopic);
        } else if (topicObj.subtopics.length > 0) {
          setSelectedSubtopic(topicObj.subtopics[0]);
        } else {
          setSelectedSubtopic('');
        }
      } else {
        setSubtopics([]);
        setSelectedSubtopic('');
      }
    } else {
      setSubtopics([]);
      setSelectedSubtopic('');
    }
  }, [selectedTopicId, topics]);

  const fetchInitialData = async () => {
    try {
      const res = await api.get('/api/subjects');
      const list = res.data || [];
      setSubjects(list);
      if (location.state && location.state.prefillSubjectId) {
        setSelectedSubjectId(location.state.prefillSubjectId);
      } else if (list.length > 0) {
        setSelectedSubjectId(list[0].id || list[0]._id);
      }
    } catch (err) { 
      console.error('Failed to load subjects', err); 
    }
  };

  const fetchTopics = async (subjectId) => {
    try {
      const res = await api.get(`/api/subjects/${subjectId}/topics`);
      const list = res.data || [];
      setTopics(list);
      if (location.state && location.state.prefillTopicId && location.state.prefillSubjectId === subjectId) {
        setSelectedTopicId(location.state.prefillTopicId);
      } else if (list.length > 0) {
        setSelectedTopicId(list[0].id || list[0]._id);
      } else {
        setSelectedTopicId('');
      }
    } catch (err) { 
      console.error('Failed to load topics', err); 
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedTopicId) return;
    setGenerating(true);
    setQuiz(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    try {
      const res = await api.post('/api/quiz/generate', {
        subject_id: selectedSubjectId, 
        topic_id: selectedTopicId,
        subtopic: selectedSubtopic || null,
        difficulty,
        question_type: questionType,
        count: questionCount
      });
      setQuiz(res.data);
    } catch (err) {
      console.error('Quiz generation failed', err);
      alert('Failed to generate quiz. Try again.');
    } finally { 
      setGenerating(false); 
    }
  };

  const handleStartFacultyQuiz = (fq) => {
    setQuiz(fq);
    setAnswers({});
    setCurrentQuestionIndex(0);
  };

  const handleOptionSelect = (qId, optionIdx) => {
    setAnswers((prev) => ({ ...prev, [qId]: String(optionIdx) }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) setCurrentQuestionIndex((p) => p + 1);
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((p) => p - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const submissionAnswers = Object.entries(answers).map(([qId, val]) => ({
      question_id: qId, submitted_answer: val
    }));
    try {
      const isFacultyQuiz = !!quiz.created_by;
      const endpoint = isFacultyQuiz 
        ? `/api/quiz/student/${quiz.id}/submit`
        : `/api/quiz/${quiz.id}/submit`;

      const res = await api.post(endpoint, { answers: submissionAnswers });
      navigate('/quiz-result', { state: { resultData: res.data } });
    } catch (err) {
      console.error('Quiz submission failed', err);
      alert('Failed to submit quiz answers. Try again.');
    } finally { 
      setSubmitting(false); 
    }
  };

  // Active quiz view
  if (quiz) {
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const totalQuestions = quiz.questions.length;
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 font-sans pb-24 sm:pb-36">
        {/* Header */}
        <div className="px-5 sm:px-8 py-4 rounded-3xl flex items-center justify-between gap-4" style={card}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 rounded-2xl shrink-0 bg-[#FFF0EB] text-[#FF5A36]">
              <FileQuestion className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold truncate text-[#1E1B18]">{quiz.title || 'Quiz Arena'}</h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#786F68]">
                {quiz.faculty_name ? `Faculty: ${quiz.faculty_name}` : `Difficulty: ${quiz.difficulty || 'Medium'}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuiz(null)}
            className="text-xs text-[#FF5A36] hover:underline font-bold px-3 py-1.5 rounded-xl bg-[#FFF0EB]"
          >
            Exit Quiz
          </button>
        </div>

        {/* Question panel */}
        <div className="p-5 sm:p-8 rounded-3xl space-y-6" style={card}>
          <div className="w-full h-2 rounded-full overflow-hidden bg-[#FFF0EB]">
            <div
              className="h-full rounded-full transition-all duration-300 bg-[#FF5A36]"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-between text-xs font-bold text-[#786F68]">
            <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <span>{answeredCount} Answered</span>
          </div>

          <h2 className="text-base sm:text-lg font-extrabold leading-relaxed text-[#1E1B18]">
            {currentQuestionIndex + 1}. {currentQuestion.question_text}
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.options && currentQuestion.options.map((option, idx) => {
              const optionCode = String(idx);
              const isSelected = answers[currentQuestion.id] === optionCode;
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(currentQuestion.id, idx)}
                  className={`p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold flex items-center gap-3.5 transition-all w-full ${
                    isSelected 
                      ? 'border-[#FF5A36] bg-[#FFF0EB] text-[#1E1B18] shadow-sm' 
                      : 'border-[#E8D8CF] bg-white text-[#1E1B18] hover:bg-[#FFF9F6]'
                  }`}
                >
                  <span className={`h-7 w-7 rounded-xl flex items-center justify-center text-xs font-black uppercase shrink-0 ${
                    isSelected 
                      ? 'bg-[#FF5A36] text-white' 
                      : 'bg-[#FFF0EB] text-[#FF5A36]'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 min-w-0 break-words">{option}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center gap-3 pt-4 border-t border-[#F3E8E2]">
            <button
              onClick={handleBack}
              disabled={currentQuestionIndex === 0}
              className="px-5 py-3 rounded-2xl text-xs font-bold transition-all disabled:opacity-40 bg-[#FFF0EB] border border-[#E8D8CF] text-[#1E1B18]"
            >
              Previous
            </button>
            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || answeredCount < totalQuestions}
                className="px-6 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all disabled:opacity-50 bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-md"
              >
                {submitting ? 'Grading...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-3 rounded-2xl text-xs font-bold transition-all bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-md"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Portal View with Tab Switcher
  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-24 sm:pb-36">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <Award className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1E1B18]">Quiz Portal</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Attempt faculty-published exams or practice with custom AI quizzes.</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="p-1 rounded-2xl bg-white border border-[#E8D8CF] flex gap-1 shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'faculty' 
                ? 'bg-[#FF5A36] text-white shadow-md' 
                : 'text-[#4A443F] hover:text-[#1E1B18]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" /> Faculty Quizzes ({assignedQuizzes.length})
          </button>
          <button
            onClick={() => setActiveTab('ai_practice')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ai_practice' 
                ? 'bg-[#FF5A36] text-white shadow-md' 
                : 'text-[#4A443F] hover:text-[#1E1B18]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Practice Generator
          </button>
        </div>
      </div>

      {activeTab === 'faculty' ? (
        <div className="space-y-4">
          {loadingAssigned ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]"></div>
            </div>
          ) : assignedQuizzes.length === 0 ? (
            <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
              <Award className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
              <h3 className="text-sm font-bold text-[#1E1B18]">No Faculty Quizzes Published Yet</h3>
              <p className="text-xs text-[#4A443F]">Your faculty members have not published any assigned quizzes yet. You can practice using the AI Practice Generator tab!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedQuizzes.map((fq) => (
                <div key={fq.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-4 flex flex-col justify-between shadow-sm hover:border-[#FF5A36] transition-all">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-1 rounded-full border border-[#FFE4D9]">
                        Duration: {fq.duration_minutes || 30} Mins
                      </span>
                      {fq.attempt ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Attempted ({fq.attempt.score}/{fq.total_marks})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          Pending Attempt
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-[#1E1B18]">{fq.title}</h3>
                    <p className="text-xs text-[#4A443F]">
                      Faculty: <span className="text-[#1E1B18] font-bold">{fq.faculty_name || 'Professor'}</span>
                    </p>
                    <div className="pt-3 border-t border-[#F3E8E2] flex items-center justify-between text-xs text-[#4A443F]">
                      <span>Questions: <strong className="text-[#1E1B18]">{fq.questions?.length || 0}</strong></span>
                      <span>Total Marks: <strong className="text-[#FF5A36] font-extrabold">{fq.total_marks || 100}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartFacultyQuiz(fq)}
                    className="w-full py-3 rounded-2xl bg-[#FF5A36] hover:bg-[#E04826] text-white text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    {fq.attempt ? 'Retake Faculty Quiz' : 'Start Assessment'} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* AI Practice Config View */
        <form onSubmit={handleGenerate} className="p-6 sm:p-8 rounded-3xl space-y-6" style={card}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Subject Course</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>-- Select Subject --</option>
                  {subjects.map((sub) => {
                    const sid = sub.id || sub._id;
                    return <option key={sid} value={sid}>{sub.name}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Quiz Topic</label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  disabled={topics.length === 0}
                  className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="" disabled>{topics.length === 0 ? '-- No Topics Available --' : '-- Select Topic --'}</option>
                  {topics.map((t) => {
                    const tid = t.id || t._id;
                    return <option key={tid} value={tid}>{t.name}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Syllabus Subtopic</label>
                <select
                  value={selectedSubtopic}
                  onChange={(e) => setSelectedSubtopic(e.target.value)}
                  disabled={subtopics.length === 0}
                  className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">-- All Subtopics --</option>
                  {subtopics.map((sub, i) => (<option key={i} value={sub}>{sub}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Question Types</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                >
                  <option value="MCQ">Standard MCQ</option>
                  <option value="Coding">Coding Questions</option>
                  <option value="Numerical">Numerical Questions</option>
                  <option value="Short Answer">Conceptual Short Q&A</option>
                  <option value="True/False">True / False Statements</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Question Count</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                >
                  <option value="3">3 Questions</option>
                  <option value="5">5 Questions</option>
                  <option value="8">8 Questions</option>
                  <option value="10">10 Questions</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Difficulty Level</label>
              <div className="grid grid-cols-3 gap-3">
                {['easy', 'medium', 'hard'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`py-3 rounded-2xl text-xs font-extrabold capitalize transition-all ${
                      difficulty === level 
                        ? 'bg-[#FF5A36] text-white shadow-md' 
                        : 'bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] hover:bg-[#FFF0EB]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={generating || !selectedTopicId}
            className="w-full py-4 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4 bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-md"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating {questionCount} {questionType} Questions...
              </>
            ) : (
              <>Generate AI Quiz <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default Quiz;
