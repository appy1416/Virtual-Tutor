import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Award, CheckCircle2, XCircle, RefreshCw, LayoutDashboard, Sparkles } from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };

const QuizResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.resultData;

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 space-y-4 font-sans px-4">
        <h2 className="text-lg font-bold text-[#1E1B18]">No result data found</h2>
        <button
          onClick={() => navigate('/quiz')}
          className="px-6 py-3 text-white font-bold rounded-2xl text-xs bg-[#FF5A36] hover:bg-[#E04826] shadow-md transition-all"
        >
          Go to Quiz Arena
        </button>
      </div>
    );
  }

  const isExcellent = result.score >= 4;
  const isGood = result.score === 3;

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 font-sans pb-24 sm:pb-36">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <Award className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1E1B18]">Quiz Evaluation</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">Check your score, examine correct options, and review AI recommendations.</p>
        </div>
      </div>

      {/* Score Card */}
      <div className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8" style={card}>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left w-full">
          <div className="h-20 w-20 rounded-3xl flex flex-col items-center justify-center text-white shrink-0 bg-[#FF5A36] shadow-lg shadow-[#FF5A36]/30">
            <span className="text-2xl font-black leading-none">{result.score}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1">/ {result.total_questions}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-[#1E1B18]">
              {isExcellent ? 'Excellent Work! 🎉' : isGood ? 'Good Job! 👍' : 'Keep Practicing! 💪'}
            </h2>
            <p className="text-xs mt-1 font-bold text-[#FF5A36]">Accuracy: {result.percentage}%</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => navigate('/quiz')}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] hover:bg-[#FFF0EB]"
          >
            <RefreshCw className="h-4 w-4" /> Try Another
          </button>
          <button
            onClick={() => navigate('/student')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-md"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </div>

      {/* AI Recommendation */}
      <div className="p-5 sm:p-6 rounded-3xl space-y-2.5 bg-[#FFF2EB] border border-[#FFE4D9]">
        <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[#FF5A36]">
          <Sparkles className="h-4 w-4 text-[#FF5A36]" /> Personalized AI Recommendation
        </h3>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#1E1B18]">
          {result.recommendation}
        </p>
      </div>

      {/* Graded Questions */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A443F]">Review Questions</h3>
        {result.graded_questions.map((q, idx) => (
          <div
            key={q.id}
            className={`p-5 sm:p-6 rounded-3xl space-y-4 border ${
              q.is_correct 
                ? 'bg-emerald-50/50 border-emerald-200' 
                : 'bg-rose-50/50 border-rose-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
              <h4 className="text-xs sm:text-sm font-extrabold leading-relaxed min-w-0 flex-1 text-[#1E1B18]">
                {idx + 1}. {q.question_text}
              </h4>
              <div className="flex shrink-0">
                {q.is_correct ? (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Correct
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                    <XCircle className="h-3 w-3" /> Wrong
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold pl-4 min-w-0 border-l-2 border-[#E8D8CF]">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#786F68]">Your Answer</span>
                <p className={`text-xs sm:text-sm truncate font-bold ${q.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Option {parseInt(q.submitted_answer) + 1}: {q.options[parseInt(q.submitted_answer)] || 'None'}
                </p>
              </div>
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#786F68]">Correct Answer</span>
                <p className="text-xs sm:text-sm truncate font-bold text-emerald-700">
                  Option {parseInt(q.correct_answer) + 1}: {q.options[parseInt(q.correct_answer)]}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizResult;
