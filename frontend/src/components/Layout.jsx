import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  GraduationCap, BookOpen, MessageSquare, Award, Calendar, 
  LogOut, LayoutDashboard, UserCheck, Menu, X, Zap, HelpCircle, FileText,
  Users, Layers, CheckSquare, Bell, BarChart2, FolderCheck, Megaphone, User, Check, Trash2, ExternalLink
} from 'lucide-react';
import api from '../services/api';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Notification Dropdown State
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      // silent fail
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.read) {
      await handleMarkRead(n.id);
    }
    setShowNotifDropdown(false);
    if (n.link) {
      navigate(n.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/api/notifications/clear-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return <>{children}</>;

  // Sidebar navigation WITHOUT separate Notifications item
  const studentNav = [
    { name: 'Dashboard', path: '/student', icon: LayoutDashboard },
    { name: 'Subjects', path: '/subjects', icon: BookOpen },
    { name: 'AI Tutor', path: '/ai-tutor', icon: Zap },
    { name: 'Doubt Solver', path: '/doubt-solver', icon: HelpCircle },
    { name: 'Reference Materials', path: '/reference-materials', icon: FileText },
    { name: 'Quizzes', path: '/quiz', icon: Award },
    { name: 'Assignments', path: '/student/assignments', icon: CheckSquare },
    { name: 'Announcements', path: '/announcements', icon: Megaphone },
    { name: 'Study Planner', path: '/planner', icon: Calendar },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const facultyNav = [
    { name: 'Dashboard', path: '/faculty', icon: LayoutDashboard },
    { name: 'My Students', path: '/faculty/students', icon: Users },
    { name: 'My Classes', path: '/faculty/classes', icon: Layers },
    { name: 'Assignments', path: '/faculty/assignments', icon: CheckSquare },
    { name: 'Submissions', path: '/faculty/submissions', icon: FolderCheck },
    { name: 'Quizzes', path: '/faculty/quizzes', icon: Award },
    { name: 'Student Progress', path: '/faculty/progress', icon: BarChart2 },
    { name: 'Class Analytics', path: '/faculty/analytics', icon: BarChart2 },
    { name: 'Learning Materials', path: '/faculty/materials', icon: FileText },
    { name: 'Announcements', path: '/faculty/announcements', icon: Megaphone },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const adminNav = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Manage Users', path: '/admin/users', icon: Users },
    { name: 'Manage Classes', path: '/admin/classes', icon: Layers },
    { name: 'Platform Analytics', path: '/admin/analytics', icon: BarChart2 },
    { name: 'AI Usage Telemetry', path: '/admin/ai-usage', icon: Zap },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const navLinks = user.role === 'faculty' ? facultyNav : user.role === 'admin' ? adminNav : studentNav;

  return (
    <div className="min-h-screen flex font-sans relative overflow-hidden" style={{ backgroundColor: '#FFF9F6', color: '#1E1B18' }}>
      
      {/* Sidebar Backdrop on Mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden transition-opacity"
          style={{ backgroundColor: 'rgba(30, 27, 24, 0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 flex flex-col shrink-0 z-50 transition-transform duration-300 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ 
          backgroundColor: '#FFF2EB', 
          borderRight: '1px solid #F3E8E2',
        }}
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid #F3E8E2' }}>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-[#FF5A36] text-white shadow-md group-hover:scale-105 transition-transform">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-[#1E1B18]">
              Tutor
            </span>
          </Link>
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg lg:hidden text-slate-500 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path) && link.path !== '/student' && link.path !== '/faculty' && link.path !== '/admin');
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={isActive ? {
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #FF5A36',
                  color: '#FF5A36',
                  boxShadow: '0 2px 8px rgba(255, 90, 54, 0.12)',
                } : {
                  color: '#665E58',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#1E1B18';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#665E58';
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: isActive ? '#FF5A36' : 'currentColor' }} />
                  <span>{link.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile + Logout */}
        <div className="p-4" style={{ borderTop: '1px solid #F3E8E2' }}>
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-white/60 border border-[#F3E8E2]">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-black text-sm uppercase shrink-0 bg-[#FF5A36] shadow-sm">
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[#1E1B18] truncate">{user.name}</p>
              <p className="text-[10px] capitalize font-bold text-[#FF5A36]">{user.role} Portal</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus:outline-none hover:bg-rose-50 hover:border-rose-200"
            style={{ color: '#E04826', border: '1px solid transparent' }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="relative z-50 h-16 flex items-center justify-between px-4 sm:px-8 shrink-0"
          style={{ 
            borderBottom: '1px solid #F3E8E2', 
            backgroundColor: 'rgba(255, 249, 246, 0.85)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-xl lg:hidden focus:outline-none bg-white border border-[#E8D8CF] text-[#665E58]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-xs font-bold tracking-wider uppercase text-[#665E58] truncate">
              {location.pathname.split('/').filter(Boolean).join(' / ') || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-3 relative" ref={notifRef}>
            {/* Header Notification Bell Icon with Badge */}
            <button
              onClick={() => setShowNotifDropdown((prev) => !prev)}
              className="relative p-2.5 rounded-xl transition-all focus:outline-none bg-white border border-[#E8D8CF] text-[#665E58] hover:border-[#FF5A36] hover:text-[#FF5A36]"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#FF5A36] text-white text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Interactive Notification Dropdown Panel */}
            {showNotifDropdown && (
              <div 
                className="absolute right-0 top-14 w-80 sm:w-96 rounded-2xl border border-[#E8D8CF] bg-white shadow-xl z-[9999] overflow-hidden space-y-0"
              >
                <div className="p-3.5 border-b border-[#F3E8E2] flex items-center justify-between bg-[#FFF2EB]">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#FF5A36]" />
                    <h3 className="text-xs font-bold text-[#1E1B18] uppercase tracking-wide">Notifications</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-[#FF5A36] hover:underline flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#F3E8E2] p-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#9E958E]">
                      No notifications found. You are all caught up!
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 rounded-xl transition-all cursor-pointer space-y-1 ${
                          !n.read 
                            ? 'bg-[#FFF2EB] border-l-2 border-[#FF5A36]' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#1E1B18] truncate">{n.title}</h4>
                          <span className="text-[9px] text-[#9E958E]">
                            {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-[#665E58]">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 bg-[#FFF9F6] ${
          location.pathname === '/messages'
            ? 'p-2 sm:p-4 overflow-hidden flex flex-col min-h-0'
            : 'overflow-y-auto p-4 sm:p-8 pb-24 sm:pb-36'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
