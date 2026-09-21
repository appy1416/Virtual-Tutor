import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Award, CheckCircle, TrendingUp, ArrowRight, Sparkles, 
  FileText, MessageSquare, Calendar, Zap, ClipboardList, Flame,
  Megaphone, ChevronRight
} from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #F3E8E2', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };
const quickLinkStyle = {
  background: '#FFF9F6',
  border: '1px solid #F3E8E2',
  color: '#1E1B18',
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    fetchDashboardStats(); 
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const [statsRes, subRes, planRes, annRes] = await Promise.all([
        api.get('/api/subjects/analytics'),
        api.get('/api/subjects'),
        api.get('/api/study-plans/active'),
        api.get('/api/announcements')
      ]);
      setStats(statsRes.data);
      setSubjects(subRes.data);
      setActivePlan(planRes.data);
      setAnnouncements(annRes.data || []);
    } catch (err) {
      console.error('Error loading student stats', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId, durationMinutes) => {
    if (!activePlan) return;
    try {
      await api.post(`/api/study-plans/${activePlan.id}/tasks/${taskId}/complete`, {
        duration_minutes: durationMinutes
      });
      const planRes = await api.get('/api/study-plans/active');
      setActivePlan(planRes.data);
      const statsRes = await api.get('/api/subjects/analytics');
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to complete task', err);
    }
  };

  const kpis = [
    { label: 'Completed Topics', value: stats?.completed_topics || 0, icon: CheckCircle, color: '#FF5A36', bg: '#FFF0EB' },
    { label: 'Current Streak', value: `${stats?.current_streak || 0} Days`, icon: Flame, color: '#FF5A36', bg: '#FFF0EB' },
    { label: 'Quiz Avg Marks', value: `${stats?.average_quiz_score || 0}%`, icon: Award, color: '#FF5A36', bg: '#FFF0EB' },
    { label: 'Enrolled Subjects', value: subjects.length || 0, icon: BookOpen, color: '#FF5A36', bg: '#FFF0EB' },
  ];

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF5A36]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">


      {/* Banner matching Tutor Hero style */}
      <div className="p-8 sm:p-10 rounded-3xl relative overflow-hidden bg-white border border-[#F3E8E2] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5A36]">
            <Sparkles className="h-4 w-4" /> Next Level AI Tutoring
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1E1B18]">
            Welcome back, <span className="text-[#FF5A36]">{user?.name}</span>!
          </h1>
          <p className="text-sm font-medium text-[#665E58] max-w-xl">
            Create a custom learning pathway to help you achieve more in school, work, and life.
          </p>
        </div>
        <button
          onClick={() => navigate('/planner')}
          className="px-6 py-3.5 rounded-full font-bold text-sm bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-lg shadow-[#FF5A36]/25 transition-all flex items-center gap-2 shrink-0 hover:scale-105"
        >
          Create Custom Plan <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="p-6 rounded-2xl flex items-center gap-4 transition-all" style={card}>
            <div className="p-3.5 rounded-2xl shrink-0" style={{ background: bg }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#665E58] truncate">{label}</p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-0.5 text-[#1E1B18]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        
        {/* Progress & Subjects Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Syllabus Progress */}
          <div className="p-6 sm:p-8 rounded-3xl space-y-5" style={card}>
            <div>
              <h2 className="text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#FF5A36]" /> Syllabus Course Mastery
              </h2>
              <p className="text-xs text-[#665E58] mt-1">Real-time overall topics mastery across CSE syllabus modules.</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-[#665E58]">
                <span>Completed Topics Mastery</span>
                <span className="text-[#FF5A36] font-extrabold">{stats?.progress_percentage || 0}%</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden bg-[#FFF2EB]">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-[#FF5A36]"
                  style={{ width: `${stats?.progress_percentage || 0}%` }}
                ></div>
              </div>
              <p className="text-xs text-[#9E958E] italic">
                Mastering a syllabus topic requires scoring 80% (4/5 answers) or higher on its practice quiz.
              </p>
            </div>
          </div>

          {/* Enrolled Subjects List */}
          <div className="p-6 sm:p-8 rounded-3xl space-y-4" style={card}>
            <div>
              <h2 className="text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#FF5A36]" /> Syllabus Subjects
              </h2>
              <p className="text-xs text-[#665E58] mt-1">Direct access links to all academic CSE subjects curriculum.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => navigate('/subjects')}
                  className="p-4.5 rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all border border-[#F3E8E2] bg-[#FFF9F6] hover:bg-[#FFF2EB] hover:border-[#FF5A36]/30"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-[#1E1B18]">{sub.name}</h4>
                    <p className="text-xs text-[#665E58] truncate mt-1">{sub.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#FF5A36]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Study Planner Tasks & Shortcuts Column */}
        <div className="space-y-6">
          {/* Active study tasks */}
          <div className="p-6 rounded-3xl space-y-4 flex flex-col h-fit" style={card}>
            <div>
              <h2 className="text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#FF5A36]" /> Active Study Plan
              </h2>
              <p className="text-xs text-[#665E58] mt-1">Pending targets from your active study plan.</p>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[240px] pr-1">
              {!activePlan || !activePlan.tasks || activePlan.tasks.length === 0 ? (
                <div className="text-center py-8 text-xs italic text-[#9E958E] space-y-2">
                  <Calendar className="h-7 w-7 mx-auto text-[#FF5A36] opacity-30" />
                  <p>No active study plan generated.</p>
                  <button onClick={() => navigate('/planner')} className="text-xs font-bold text-[#FF5A36] uppercase tracking-wider underline">
                    Generate plan now
                  </button>
                </div>
              ) : (
                activePlan.tasks.map((task) => (
                  <div
                    key={task.task_id}
                    className="p-3.5 rounded-2xl flex items-center justify-between gap-3 border transition-all"
                    style={{
                      background: task.completed ? '#F0FDF4' : '#FFF9F6',
                      borderColor: task.completed ? '#BBF7D0' : '#F3E8E2'
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate text-[#1E1B18] ${task.completed ? 'line-through opacity-50' : ''}`}>
                        {task.description}
                      </p>
                      <p className="text-[10px] text-[#665E58] truncate mt-0.5">{task.subject} • {task.duration_minutes}m</p>
                    </div>

                    <button
                      disabled={task.completed}
                      onClick={() => handleToggleComplete(task.task_id, task.duration_minutes)}
                      className="p-1 rounded-md transition-all shrink-0"
                      style={{ color: task.completed ? '#16A34A' : '#9E958E' }}
                    >
                      <CheckCircle className={`h-5 w-5 ${task.completed ? 'opacity-100' : 'opacity-40 hover:opacity-100 hover:text-[#FF5A36] cursor-pointer'}`} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dynamic Interactive Shortcuts links */}
          <div className="p-6 rounded-3xl space-y-4" style={card}>
            <div>
              <h2 className="text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#FF5A36]" /> Interactive Shortcuts
              </h2>
              <p className="text-xs text-[#665E58] mt-1">Quick links to navigate through learning portals.</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                { name: 'Learn Syllabus Subjects', icon: BookOpen, path: '/subjects', label: 'Browse curriculum hierarchy' },
                { name: 'Practice MCQ/Coding Quiz', icon: Award, path: '/quiz', label: 'Generate custom assessments' },
                { name: 'Solve Doubts with RAG', icon: MessageSquare, path: '/doubt-solver', label: 'Consult virtual textbook' },
                { name: 'Active Study Planner', icon: Calendar, path: '/planner', label: 'Monitor schedule targets' },
                { name: 'Open Reference Materials', icon: FileText, path: '/reference-materials', label: 'Catalog course slides' }
              ].map((link, idx) => {
                const Icon = link.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => navigate(link.path)}
                    className="p-3.5 rounded-2xl text-left flex items-center gap-3 transition-all group hover:bg-[#FFF2EB] hover:border-[#FF5A36]/30"
                    style={quickLinkStyle}
                  >
                    <div className="p-2.5 rounded-xl bg-[#FFF0EB] text-[#FF5A36] group-hover:scale-105 transition-all">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1E1B18]">{link.name}</p>
                      <p className="text-[10px] text-[#665E58] mt-0.5">{link.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;
