import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronUp, BookOpenCheck, ArrowRight } from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [topicsMap, setTopicsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/subjects');
      setSubjects(res.data || []);
    } catch (err) {
      console.error('Failed to load subjects', err);
    } finally { setLoading(false); }
  };

  const handleToggleSubject = async (subjectId) => {
    if (expandedSubjectId === subjectId) { setExpandedSubjectId(null); return; }
    setExpandedSubjectId(subjectId);
    if (!topicsMap[subjectId]) {
      try {
        const res = await api.get(`/api/subjects/${subjectId}/topics`);
        setTopicsMap((prev) => ({ ...prev, [subjectId]: res.data }));
      } catch (err) { console.error(`Failed to load topics for subject ${subjectId}`, err); }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF5A36]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 font-sans pb-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1E1B18]">CSE Course Curriculum</h1>
          <p className="text-xs sm:text-sm font-medium text-[#4A443F] mt-0.5">Explore subjects, select a topic, and master your concepts.</p>
        </div>
      </div>

      <div className="space-y-4">
        {subjects.map((subject) => {
          const isExpanded = expandedSubjectId === subject.id;
          const topics = topicsMap[subject.id] || [];
          return (
            <div key={subject.id} className="rounded-3xl overflow-hidden transition-all" style={card}>
              <div
                onClick={() => handleToggleSubject(subject.id)}
                className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer select-none min-w-0 transition-all hover:bg-[#FFF9F6]"
                style={{ borderBottom: isExpanded ? '1px solid #F3E8E2' : 'none' }}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="p-3 rounded-2xl bg-[#FFF0EB] text-[#FF5A36] shrink-0">
                    <BookOpenCheck className="h-5 w-5 text-[#FF5A36]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-black truncate text-[#1E1B18]">{subject.name}</h3>
                    <p className="text-xs text-[#4A443F] mt-0.5 max-w-2xl truncate font-medium">{subject.description}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-[#FF5A36]" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#786F68]" />
                )}
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 bg-[#FFF9F6]">
                  <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {topics.length === 0 ? (
                      <div className="col-span-2 text-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5A36] mx-auto"></div>
                      </div>
                    ) : (
                      topics.map((topic) => (
                        <div
                          key={topic.id}
                          onClick={() => navigate(`/subjects/${subject.id}/topics/${topic.id}`)}
                          className="p-4 sm:p-5 rounded-2xl cursor-pointer flex items-center justify-between gap-4 transition-all min-w-0 bg-white border border-[#E8D8CF] hover:border-[#FF5A36] shadow-sm"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <h4 className="text-sm font-extrabold truncate text-[#1E1B18]">{topic.name}</h4>
                            <p className="text-xs text-[#4A443F] truncate font-medium">{topic.description}</p>
                          </div>
                          <div className="p-2 rounded-xl shrink-0 bg-[#FFF0EB] text-[#FF5A36]">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Subjects;
