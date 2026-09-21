import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  Users, BookOpen, FileText, AlertTriangle, TrendingUp, Sparkles, ShieldCheck, CheckSquare, Award, FolderCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E8D8CF',
  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
};

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacultyData();
  }, []);

  const fetchFacultyData = async () => {
    try {
      const [dashRes, clsRes] = await Promise.all([
        api.get('/api/faculty/dashboard'),
        api.get('/api/faculty/classes')
      ]);
      setStats(dashRes.data);
      setClasses(clsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch faculty data', err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    { label: 'Assigned Classes', value: stats?.total_classes || 0, icon: BookOpen, color: '#FF5A36', bg: '#FFF0EB' },
    { label: 'Total Students', value: stats?.total_students || 0, icon: Users, color: '#FF5A36', bg: '#FFF0EB' },
    { label: 'Pending Submissions', value: stats?.pending_submissions || 0, icon: FolderCheck, color: '#FF5A36', bg: '#FFF0EB' },
    { label: 'Avg Class Score', value: `${stats?.average_class_score || 0}%`, icon: ShieldCheck, color: '#FF5A36', bg: '#FFF0EB' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-6">

      {/* Faculty welcome banner */}
      <div className="p-6 sm:p-8 rounded-3xl relative overflow-hidden bg-white border border-[#E8D8CF] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5A36]">
            <Sparkles className="h-4 w-4" /> Tutor Faculty Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B18] tracking-tight">
            Faculty Overview Portal
          </h1>
          <p className="text-[#4A443F] font-medium max-w-lg text-xs sm:text-sm leading-relaxed">
            Manage your assigned classes, publish homework assignments, create quizzes, grade student submissions, and send direct messages.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="p-5 rounded-3xl flex items-center gap-4 transition-all" style={cardStyle}>
            <div className="p-3.5 rounded-2xl shrink-0" style={{ background: bg }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#786F68]">{label}</p>
              <p className="text-2xl sm:text-3xl font-black mt-0.5 text-[#1E1B18]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students needing attention */}
        <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl space-y-6" style={cardStyle}>
          <div>
            <h2 className="text-base font-black flex items-center gap-2 text-[#1E1B18]">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Students Needing Support
            </h2>
            <p className="text-xs mt-1 text-[#4A443F]">Real MongoDB tracking of students with low quiz scores or low activity.</p>
          </div>

          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-xs text-[#786F68] py-6 text-center">Loading student records...</div>
            ) : !stats?.students_needing_attention || stats.students_needing_attention.length === 0 ? (
              <div className="text-xs text-[#786F68] py-8 text-center italic">All students are progressing normally!</div>
            ) : (
              stats.students_needing_attention.map((st) => (
                <div key={st.id} className="p-4 rounded-2xl border border-[#E8D8CF] bg-[#FFF9F6] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#1E1B18]">{st.name}</h4>
                    <p className="text-[10px] text-[#786F68]">{st.email} • <span className="text-rose-600 font-bold">{st.issue}</span></p>
                  </div>
                  <button
                    onClick={() => navigate('/messages')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#FF5A36] text-white text-xs font-bold hover:bg-[#E04826] shadow-sm transition-all"
                  >
                    Message Student
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assigned Classes Overview */}
        <div className="p-6 sm:p-8 rounded-3xl flex flex-col justify-between" style={cardStyle}>
          <div>
            <h2 className="text-base font-black flex items-center gap-2 text-[#1E1B18]">
              <TrendingUp className="h-5 w-5 text-[#FF5A36]" /> Assigned Classes
            </h2>
            <p className="text-xs mt-1 text-[#4A443F]">Classes assigned to you by Administrator.</p>
          </div>

          <div className="space-y-3.5 my-5 max-h-[220px] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5A36]"></div>
              </div>
            ) : classes.length === 0 ? (
              <p className="text-xs italic text-center py-6 text-[#786F68]">No assigned classes available.</p>
            ) : (
              classes.map((cls) => (
                <div key={cls.id} className="p-3.5 rounded-2xl flex items-center justify-between bg-[#FFF9F6] border border-[#E8D8CF]">
                  <div className="truncate">
                    <p className="text-xs font-bold truncate text-[#1E1B18]">{cls.name}</p>
                    <p className="text-[10px] text-[#786F68]">Code: {cls.code}</p>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9]">
                    {cls.student_count || 0} students
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => navigate('/faculty/classes')}
            className="w-full py-3 rounded-2xl text-center text-xs font-extrabold transition-all border border-[#E8D8CF] text-[#1E1B18] bg-[#FFF0EB] hover:bg-[#FFE4D9]"
          >
            Manage Classes
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
