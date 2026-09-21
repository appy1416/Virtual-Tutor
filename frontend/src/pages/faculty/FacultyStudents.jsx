import React, { useState, useEffect } from 'react';
import { Users, Search, Award, BookOpen, AlertCircle, BarChart2 } from 'lucide-react';
import api from '../../services/api';

const FacultyStudents = () => {
  const [classes, setClasses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentProgress, setStudentProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/classes');
        setClasses(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleInspectStudent = async (studentId) => {
    try {
      const res = await api.get(`/api/faculty/student-progress/${studentId}`);
      setStudentProgress(res.data);
      setSelectedStudent(res.data.student);
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
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E1B18]">My Assigned Students</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">Monitor individual student progress, quiz attempts, and homework completion.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster Column */}
        <div className="lg:col-span-1 space-y-4">
          {classes.map((cls) => (
            <div key={cls.id} className="p-5 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-black text-[#FF5A36] uppercase tracking-wider">{cls.name} ({cls.code})</h3>
              <div className="space-y-2">
                {cls.students && cls.students.length > 0 ? (
                  cls.students.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => handleInspectStudent(st.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedStudent?.id === st.id
                          ? 'bg-[#FFF0EB] border-[#FF5A36] text-[#1E1B18] shadow-sm'
                          : 'bg-[#FFF9F6] border-[#E8D8CF] text-[#1E1B18] hover:border-[#FF5A36]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-[#FF5A36] text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                          {st.name ? st.name.charAt(0) : 'S'}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-[#1E1B18]">{st.name}</p>
                          <p className="text-[10px] text-[#786F68] font-medium">{st.email}</p>
                        </div>
                      </div>
                      <BarChart2 className="h-4 w-4 text-[#FF5A36]" />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#786F68] italic">No students enrolled in this roster.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Progress Column */}
        <div className="lg:col-span-2">
          {studentProgress ? (
            <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#F3E8E2]">
                <div>
                  <h2 className="text-xl font-black text-[#1E1B18]">{studentProgress.student?.name}</h2>
                  <p className="text-xs text-[#FF5A36] font-bold">{studentProgress.student?.email}</p>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Streak: {studentProgress.analytics?.streak_count || 0} Days
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] text-center">
                  <p className="text-[10px] text-[#786F68] font-bold uppercase">Avg Score</p>
                  <p className="text-xl font-black text-[#FF5A36]">{studentProgress.analytics?.average_quiz_score}%</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] text-center">
                  <p className="text-[10px] text-[#786F68] font-bold uppercase">Completed Topics</p>
                  <p className="text-xl font-black text-[#1E1B18]">{studentProgress.analytics?.completed_topics_count}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] text-center">
                  <p className="text-[10px] text-[#786F68] font-bold uppercase">Submissions</p>
                  <p className="text-xl font-black text-[#1E1B18]">{studentProgress.submissions?.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] text-center">
                  <p className="text-[10px] text-[#786F68] font-bold uppercase">Progress</p>
                  <p className="text-xl font-black text-emerald-600">{studentProgress.analytics?.progress_percentage}%</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-[#1E1B18] mb-3">AI Recommendations for Student</h3>
                <div className="space-y-2">
                  {studentProgress.analytics?.recommendations?.map((r, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] text-xs flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-[#1E1B18]">{r.message}</p>
                        <p className="text-xs text-[#4A443F] mt-0.5">{r.description}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-1 rounded-full border border-[#FFE4D9]">
                        {r.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center text-xs font-semibold text-[#786F68] shadow-sm">
              Select a student from your class roster on the left to inspect their progress.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyStudents;
