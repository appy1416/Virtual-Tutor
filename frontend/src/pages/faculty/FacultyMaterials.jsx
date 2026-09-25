import React, { useState, useEffect } from 'react';
import { FileText, Upload, Plus, Trash2, BookOpen, CheckCircle2, AlertCircle, X, Download, ExternalLink } from 'lucide-react';
import api, { API_BASE_URL } from '../../services/api';

const FacultyMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('pdf');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [classId, setClassId] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);

  const fetchData = async () => {
    try {
      const [mRes, sRes, cRes] = await Promise.all([
        api.get('/api/reference-materials'),
        api.get('/api/subjects'),
        api.get('/api/classes')
      ]);
      setMaterials(mRes.data || []);
      setSubjects(sRes.data || []);
      setClasses(cRes.data || []);
      if (sRes.data?.length > 0) setSubjectId(sRes.data[0].id);
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

  useEffect(() => {
    if (!subjectId) return;
    const fetchTopics = async () => {
      try {
        const res = await api.get(`/api/subjects/${subjectId}/topics`);
        setTopics(res.data || []);
        if (res.data?.length > 0) setTopicId(res.data[0].id);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTopics();
  }, [subjectId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!title || !subjectId || !topicId) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('type', type);
    formData.append('subject_id', subjectId);
    formData.append('topic_id', topicId);
    if (classId) formData.append('class_id', classId);
    if (content) formData.append('content', content);
    if (file) formData.append('file', file);

    try {
      await api.post('/api/reference-materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFeedbackMsg({ type: 'success', text: 'Material uploaded and indexed successfully.' });
      setTimeout(() => {
        setShowModal(false);
        setFeedbackMsg(null);
        setTitle('');
        setContent('');
        setFile(null);
        fetchData();
      }, 1200);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to upload material.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/reference-materials/${id}`);
      fetchData();
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
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Learning Materials Manager</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Upload slides, notes, and PDFs. Files are automatically indexed into RAG for AI Tutor retrieval.</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setFeedbackMsg(null); }}
          className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Upload Material
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <FileText className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Learning Materials Uploaded</h3>
          <p className="text-xs text-[#4A443F]">Upload notes or PDFs to build your class knowledge base.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map((m) => (
            <div key={m.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-3 shadow-sm hover:border-[#FF5A36] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#FF5A36] uppercase bg-[#FFF0EB] px-2.5 py-0.5 rounded-full border border-[#FFE4D9]">
                  {m.type}
                </span>
                <button onClick={() => handleDelete(m.id)} className="text-[#786F68] hover:text-rose-600 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="text-base font-extrabold text-[#1E1B18]">{m.title}</h3>
              {m.summary && <p className="text-xs text-[#4A443F] leading-relaxed">{m.summary}</p>}
              
              <div className="flex items-center gap-2 pt-3 border-t border-[#F3E8E2]">
                {m.file_path && (
                  <>
                    <a
                      href={`${API_BASE_URL}/api/reference-materials/${m.id}/download`}
                      download={`${(m.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
                      title="Download PDF File"
                      className="px-3 py-1.5 rounded-xl bg-[#FFF9F6] border border-[#E8D8CF] text-[#FF5A36] hover:bg-[#FFF0EB] transition-all flex items-center gap-1.5 text-xs font-bold"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </a>
                    <a
                      href={`${API_BASE_URL}/uploads/reference_materials/${m.file_path.split(/[\\/]/).pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Browser"
                      className="p-1.5 rounded-xl bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] hover:bg-[#FFF0EB] transition-all"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-[#1E1B18]">Upload Course Material</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-full text-[#786F68] hover:text-[#1E1B18]">
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

            <form onSubmit={handleUpload} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 4 - B-Trees & Indexing Lecture Notes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Target Class</label>
                {classes.length === 0 ? (
                  <p className="text-xs text-amber-800 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No classes assigned to you. Material will be accessible to all your students.
                  </p>
                ) : (
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Material Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="pptx">PowerPoint (.pptx)</option>
                    <option value="docx">Word (.docx)</option>
                    <option value="text">Text Notes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">Topic</label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {type === 'text' ? (
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">Content Text</label>
                  <textarea
                    rows={4}
                    placeholder="Type raw notes content here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl p-3 text-xs font-semibold text-[#1E1B18] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">File Attachment</label>
                  <input
                    type="file"
                    accept={type === 'pdf' ? '.pdf,application/pdf' : type === 'pptx' ? '.pptx' : type === 'docx' ? '.docx' : '*'}
                    onChange={(e) => setFile(e.target.files[0])}
                    className="w-full text-xs text-[#1E1B18] cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3E8E2]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#786F68] hover:bg-[#FFF2EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5A36] text-white text-xs font-extrabold hover:bg-[#E04826] disabled:opacity-50 shadow-md"
                >
                  {uploading ? 'Processing & Indexing...' : 'Upload & Index into RAG'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyMaterials;
