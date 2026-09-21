import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, AlertTriangle, Users, BookOpen, Award } from 'lucide-react';
import api from '../../services/api';

const FacultyAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/faculty/dashboard');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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
          <BarChart2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E1B18]">Class Analytics & Mastery Heatmap</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">Aggregated class scores, weak topic heatmaps, and learning trends.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Average Class Score</p>
          <p className="text-3xl font-black text-[#FF5A36]">{stats?.average_class_score}%</p>
          <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> +4.2% from last month
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Total Students</p>
          <p className="text-3xl font-black text-[#1E1B18]">{stats?.total_students}</p>
          <p className="text-xs text-[#4A443F]">Active across assigned classes</p>
        </div>

        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Assignment Completion</p>
          <p className="text-3xl font-black text-[#1E1B18]">{stats?.completed_submissions}</p>
          <p className="text-xs text-[#4A443F]">{stats?.pending_submissions} pending review</p>
        </div>

        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Class Sections</p>
          <p className="text-3xl font-black text-emerald-600">{stats?.total_classes}</p>
          <p className="text-xs text-[#4A443F]">Teaching rosters</p>
        </div>
      </div>

      {/* Weak Topics Heatmap */}
      <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#1E1B18] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Classroom Weak Topics Heatmap
          </h2>
          <span className="text-xs text-amber-800 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Automated BKT Analytics
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats?.weak_topics?.map((wt, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#786F68] uppercase">{wt.subject}</span>
                <span className="text-xs font-black text-rose-600">{wt.avg_mastery}% Mastery</span>
              </div>
              <h3 className="text-sm font-extrabold text-[#1E1B18]">{wt.topic}</h3>
              
              <div className="w-full h-2.5 rounded-full bg-[#E8D8CF] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full" style={{ width: `${wt.avg_mastery}%` }} />
              </div>
              <p className="text-xs text-[#786F68]">{wt.student_count} students require targeted review</p>
            </div>
          ))}
        </div>
      </div>

      {/* Students Needing Attention */}
      <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-4">
        <h2 className="text-base font-black text-[#1E1B18] flex items-center gap-2">
          <Users className="h-5 w-5 text-rose-500" />
          Students Needing Academic Attention
        </h2>

        <div className="space-y-3">
          {stats?.students_needing_attention?.map((st) => (
            <div key={st.id} className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-[#1E1B18]">{st.name}</h4>
                <p className="text-xs text-rose-700 font-medium">{st.issue}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-[#FF5A36]">Avg: {st.avg_score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FacultyAnalytics;
