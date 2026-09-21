import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Calendar, CheckCircle2, AlertCircle, X, Image as ImageIcon, ExternalLink } from 'lucide-react';
import api from '../../services/api';

const FacultyAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [classId, setClassId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const fetchData = async () => {
    try {
      const [aRes, cRes] = await Promise.all([
        api.get('/api/announcements'),
        api.get('/api/classes')
      ]);
      setAnnouncements(aRes.data || []);
      setClasses(cRes.data || []);
      if (cRes.data?.length > 0) setClassId(cRes.data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && (!classId || !classes.some(c => c.id === classId))) {
      setClassId(classes[0].id);
    }
  }, [classes, showModal]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to delete announcement', err);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const activeClassId = classId || (classes.length > 0 ? classes[0].id : '');

    if (!activeClassId) {
      setFeedbackMsg({ type: 'error', text: 'No class section selected or assigned to you.' });
      return;
    }

    if (!title.trim() || !message.trim()) return;
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('message', message.trim());
      formData.append('class_id', activeClassId);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await api.post('/api/announcements', formData);
      setFeedbackMsg({ type: 'success', text: 'Announcement posted and students notified successfully.' });
      setTimeout(() => {
        setShowModal(false);
        setFeedbackMsg(null);
        setTitle('');
        setMessage('');
        handleClearImage();
        fetchData();
      }, 1200);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to post announcement.' });
    } finally {
      setPosting(false);
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
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <Megaphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Class Broadcast Announcements</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Post announcements and images to enrolled class sections. Generates real-time notifications for students.</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setFeedbackMsg(null); }}
          className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Post Announcement
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <Megaphone className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Announcements Posted</h3>
          <p className="text-xs text-[#4A443F]">Click Post Announcement to broadcast messages and diagrams to your students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {announcements.map((a) => (
            <div key={a.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-3.5 shadow-sm hover:border-[#FF5A36] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-0.5 rounded-full border border-[#FFE4D9]">
                  Target Class: {a.class_name || 'Class Broadcast'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#786F68] font-semibold">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                  </span>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                    title="Delete Announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-base font-extrabold text-[#1E1B18]">{a.title}</h3>
              <p className="text-xs sm:text-sm text-[#4A443F] leading-relaxed whitespace-pre-line font-medium">{a.message || a.content}</p>

              {/* Announcement Attached Image */}
              {a.image_url && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-[#E8D8CF] bg-[#FFF9F6] p-1 group relative max-w-xl">
                  <img 
                    src={a.image_url.startsWith('http') ? a.image_url : `http://localhost:8000${a.image_url}`} 
                    alt={a.title} 
                    className="w-full max-h-80 object-contain rounded-xl"
                  />
                  <a
                    href={a.image_url.startsWith('http') ? a.image_url : `http://localhost:8000${a.image_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm"
                  >
                    <ExternalLink className="h-3 w-3" /> Full Size
                  </a>
                </div>
              )}

              <div className="pt-3 border-t border-[#F3E8E2] text-xs text-[#786F68] flex items-center justify-between">
                <span>Posted by: <strong className="text-[#1E1B18]">{a.author_name || 'Faculty'}</strong></span>
                {a.students_notified !== undefined && (
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ✓ Notified {a.students_notified} student(s)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Broadcast Announcement</h2>
              <button onClick={() => { setShowModal(false); handleClearImage(); }} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {feedbackMsg && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                feedbackMsg.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                {feedbackMsg.text}
              </div>
            )}

            <form onSubmit={handlePost} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Target Class Section</label>
                {classes.length === 0 ? (
                  <p className="text-xs text-amber-800 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No classes assigned to you. Contact Admin to assign teaching sections.
                  </p>
                ) : (
                  <>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code}) — {c.students?.length ?? (c.student_count || 0)} Enrolled Students
                        </option>
                      ))}
                    </select>

                    {(() => {
                      const selectedCls = classes.find(c => c.id === (classId || classes[0]?.id));
                      if (!selectedCls) return null;
                      const enrolled = selectedCls.students || [];
                      if (enrolled.length > 0) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold flex items-start gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Enrolled Students ({enrolled.length}):</strong>{' '}
                              {enrolled.map(s => s.name || s.email).join(', ')}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <p className="mt-1.5 text-[11px] text-[#786F68] italic">
                          No students enrolled in this section yet. Announcements will be visible once students are enrolled.
                        </p>
                      );
                    })()}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Change: Lab Session Rescheduled"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter announcement details..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              {/* Image Upload Feature */}
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">
                  Attach Image or Diagram (Optional)
                </label>
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-[#E8D8CF] bg-[#FFF9F6] p-2 flex items-center justify-between">
                    <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-xl object-cover border border-[#E8D8CF]" />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold flex items-center gap-1 mr-2"
                    >
                      <X className="h-3.5 w-3.5" /> Remove Image
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E8D8CF] hover:border-[#FF5A36] bg-[#FFF9F6] rounded-2xl p-3.5 cursor-pointer transition-all">
                    <ImageIcon className="h-5 w-5 text-[#FF5A36] mb-1" />
                    <span className="text-xs font-bold text-[#1E1B18]">Attach image (diagram, schedule, formula chart)</span>
                    <span className="text-[10px] text-[#786F68] mt-0.5">PNG, JPG, JPEG, WEBP, GIF</span>
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.gif,.webp"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); handleClearImage(); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {posting ? 'Broadcasting...' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAnnouncements;
