import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, AlertCircle, MessageSquare, Award, FileText, Check, Trash2 } from 'lucide-react';
import api from '../../services/api';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
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

  const getIcon = (type) => {
    switch (type) {
      case 'assignment': return <FileText className="h-5 w-5 text-[#FF5A36]" />;
      case 'submission': return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'grade': return <Award className="h-5 w-5 text-[#FF5A36]" />;
      case 'quiz': return <Award className="h-5 w-5 text-amber-600" />;
      case 'message': return <MessageSquare className="h-5 w-5 text-[#FF5A36]" />;
      default: return <Bell className="h-5 w-5 text-[#786F68]" />;
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
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#1E1B18]">Notifications</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Real-time alerts, assignment deadlines, and message notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-[#FF5A36] bg-[#FFF0EB] border border-[#FFE4D9] hover:bg-[#FFE4D9] transition-all flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Mark All Read ({unreadCount})
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <Bell className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Notifications</h3>
          <p className="text-xs text-[#4A443F]">You are all caught up! Updates will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-5 rounded-3xl border transition-all flex items-start gap-4 cursor-pointer shadow-sm ${
                !n.read 
                  ? 'bg-[#FFF2EB] border-[#FF5A36]' 
                  : 'bg-white border-[#E8D8CF] hover:border-[#FF5A36]'
              }`}
            >
              <div className="p-2.5 rounded-2xl bg-white border border-[#E8D8CF] shrink-0 shadow-sm">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#1E1B18] truncate">{n.title}</h3>
                  <span className="text-[10px] text-[#786F68] font-medium shrink-0">
                    {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-xs text-[#4A443F] mt-1 leading-relaxed font-medium">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
