import React, { useState } from 'react';
import api from '../../services/api';
import { 
  Sparkles, FileText, Clipboard, Printer, AlertCircle, RefreshCcw
} from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E8D8CF',
  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
};

const ExamCreator = () => {
  const [subject, setSubject] = useState('Java');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);
  
  const [examPaper, setExamPaper] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setExamPaper('');
    setCopied(false);

    try {
      const res = await api.post('/api/ai-tutor/generate-exam', {
        subject,
        topic,
        difficulty,
        count: parseInt(count, 10),
      });
      setExamPaper(res.data.exam_paper);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to generate exam paper. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!examPaper) return;
    navigator.clipboard.writeText(examPaper);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-6">
      
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E8D8CF] shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5A36]">
            <Sparkles className="h-4 w-4" /> AI Question Paper Generator
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B18] tracking-tight">
            Exam & Assessment Generator
          </h1>
          <p className="text-xs sm:text-sm text-[#4A443F]">
            Produce customized question papers complete with grading rubrics and solution keys.
          </p>
        </div>
      </div>

      {/* Generator Form */}
      <div className="p-6 sm:p-8 rounded-3xl" style={cardStyle}>
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Subject Course</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
              >
                <option value="Java">Java Programming</option>
                <option value="Python">Python Programming</option>
                <option value="Data Structures">Data Structures</option>
                <option value="DBMS">DBMS</option>
                <option value="Operating Systems">Operating Systems</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Machine Learning">Machine Learning</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Topic Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Relational Calculus & Normalization"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Target Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
              >
                <option value="easy">Easy / Beginner</option>
                <option value="medium">Medium / Standard</option>
                <option value="hard">Hard / Comprehensive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Number of Questions</label>
              <input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full py-4 rounded-2xl bg-[#FF5A36] text-white text-xs font-black uppercase tracking-wider hover:bg-[#E04826] transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Generating Comprehensive Exam Paper...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate AI Question Paper
              </>
            )}
          </button>
        </form>
      </div>

      {/* Generated Paper Preview */}
      {examPaper && (
        <div className="p-6 sm:p-8 rounded-3xl space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between pb-4 border-b border-[#F3E8E2]">
            <h2 className="text-base font-extrabold text-[#1E1B18] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#FF5A36]" /> Generated Examination Paper
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3.5 py-1.5 rounded-xl border border-[#E8D8CF] text-xs font-bold bg-[#FFF9F6] text-[#1E1B18] hover:bg-[#FFF0EB] flex items-center gap-1.5 transition-all"
              >
                <Clipboard className="h-3.5 w-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-xl border border-[#E8D8CF] text-xs font-bold bg-[#FFF9F6] text-[#1E1B18] hover:bg-[#FFF0EB] flex items-center gap-1.5 transition-all"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </div>

          <pre className="p-5 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18]">
            {examPaper}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ExamCreator;
