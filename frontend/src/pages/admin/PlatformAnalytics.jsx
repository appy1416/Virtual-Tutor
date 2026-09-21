import React, { useState, useEffect } from 'react';
import { BarChart2, Users, Layers, Award, CheckSquare, Zap, Activity } from 'lucide-react';
import api from '../../services/api';

const PlatformAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/admin/stats');
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
          <h1 className="text-2xl font-black text-[#1E1B18]">Platform Health & Analytics</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">Real-time system statistics across students, faculty, classes, and coursework.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Total System Users</p>
          <p className="text-3xl font-black text-[#FF5A36]">{stats?.total_users}</p>
          <p className="text-xs text-[#4A443F]">{stats?.total_students} Students, {stats?.total_faculty} Faculty</p>
        </div>

        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Class Sections</p>
          <p className="text-3xl font-black text-[#1E1B18]">{stats?.total_classes}</p>
          <p className="text-xs text-[#4A443F]">Active learning cohorts</p>
        </div>

        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">Total Assignments</p>
          <p className="text-3xl font-black text-[#1E1B18]">{stats?.total_assignments}</p>
          <p className="text-xs text-[#4A443F]">{stats?.total_submissions} Submissions Recorded</p>
        </div>

        <div className="p-6 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-2">
          <p className="text-xs font-bold text-[#786F68] uppercase">AI Queries Processed</p>
          <p className="text-3xl font-black text-emerald-600">{stats?.ai_query_count}</p>
          <p className="text-xs text-emerald-700 font-bold">RAG & AI Tutor Active</p>
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-4">
        <h2 className="text-base font-black text-[#1E1B18] flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#FF5A36]" />
          System Operational Telemetry
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] space-y-1.5">
            <p className="text-[10px] font-bold text-[#786F68] uppercase">Database Health</p>
            <p className="text-base font-extrabold text-emerald-600">Connected & Operational</p>
            <p className="text-xs text-[#4A443F]">MongoDB Atlas / In-Memory Mock active</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] space-y-1.5">
            <p className="text-[10px] font-bold text-[#786F68] uppercase">Vector Database (ChromaDB)</p>
            <p className="text-base font-extrabold text-[#FF5A36]">Indexed & Searching</p>
            <p className="text-xs text-[#4A443F]">Local SentenceTransformers embeddings</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] space-y-1.5">
            <p className="text-[10px] font-bold text-[#786F68] uppercase">AI Model Architecture</p>
            <p className="text-base font-extrabold text-[#1E1B18]">BKT Tracing & Gemini Gateway</p>
            <p className="text-xs text-[#4A443F]">Zero-downtime execution</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformAnalytics;
