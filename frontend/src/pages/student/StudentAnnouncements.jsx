import React, { useState, useEffect } from 'react';
import { Megaphone, Calendar, BookOpen, Clock, AlertCircle, ExternalLink, Image as ImageIcon } from 'lucide-react';
import api from '../../services/api';

const StudentAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/api/announcements');
      setAnnouncements(res.data || []);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <Megaphone className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E1B18]">Class Broadcast Announcements</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">
            Important updates, lecture schedule changes, diagrams, and notes broadcast by your course instructors.
          </p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <Megaphone className="h-10 w-10 text-[#FF5A36] mx-auto opacity-30" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Announcements Yet</h3>
          <p className="text-xs text-[#4A443F]">
            Your instructors haven't broadcast any updates to your enrolled class sections yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {announcements.map((a) => {
            const formattedDate = a.created_at 
              ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : 'Recent';

            const imageUrl = a.image_url
              ? (a.image_url.startsWith('http') ? a.image_url : `http://localhost:8000${a.image_url}`)
              : null;

            return (
              <div
                key={a.id || a._id}
                className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 space-y-4 relative"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg sm:text-xl font-black text-[#1E1B18] tracking-tight flex items-center gap-2 uppercase">
                      <span>📌</span> {a.title || 'CIRCULAR'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 pt-0.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Priority / Tag Badge */}
                  <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#EAF2FF] text-[#2B6CB0] border border-[#D0E2FF] shrink-0">
                    {a.priority || a.class_name || 'MEDIUM'}
                  </span>
                </div>

                {/* Uploaded Circular Document Image */}
                {imageUrl && (
                  <div className="w-full rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 p-2 shadow-inner flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt={a.title || 'Announcement'}
                      className="w-full max-h-[600px] object-contain rounded-xl shadow-sm hover:scale-[1.005] transition-transform"
                    />
                  </div>
                )}

                {/* Message Content */}
                <p className="text-sm font-semibold text-gray-700 leading-relaxed uppercase tracking-wide pt-1">
                  {a.message || a.content || a.title}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentAnnouncements;
