import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Upload, Folder, Trash2, Plus, Sparkles, AlertCircle, CheckCircle, ExternalLink, HelpCircle, Download
} from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };

const ReferenceMaterials = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState('text');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopics(selectedSubjectId);
    } else {
      setTopics([]);
      setSelectedTopicId('');
    }
  }, [selectedSubjectId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const subRes = await api.get('/api/subjects');
      setSubjects(subRes.data || []);
      if (subRes.data?.length > 0) {
        setSelectedSubjectId(subRes.data[0].id);
      }
      fetchAllMaterials();
    } catch (err) {
      console.error('Failed to load initial data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopics = async (subjectId) => {
    try {
      const res = await api.get(`/api/subjects/${subjectId}/topics`);
      setTopics(res.data || []);
      if (res.data?.length > 0) {
        setSelectedTopicId(res.data[0].id);
      } else {
        setSelectedTopicId('');
      }
    } catch (err) {
      console.error('Failed to load topics', err);
    }
  };

  const fetchAllMaterials = async () => {
    try {
      const res = await api.get('/api/reference-materials');
      setMaterials(res.data || []);
    } catch (err) {
      console.error('Failed to load materials catalog', err);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedTopicId || !title.trim()) return;
    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('subject_id', selectedSubjectId);
    formData.append('topic_id', selectedTopicId);
    formData.append('title', title);
    formData.append('type', type);

    if (type === 'text') {
      if (!content.trim()) {
        setErrorMsg('Please enter text content for your notes.');
        setUploading(false);
        return;
      }
      formData.append('content', content);
    } else {
      if (!file) {
        setErrorMsg('Please select a document file to upload.');
        setUploading(false);
        return;
      }
      formData.append('file', file);
    }

    try {
      await api.post('/api/reference-materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessMsg('Reference material uploaded and indexed successfully into vector knowledge base!');
      setTitle('');
      setContent('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchAllMaterials();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to upload material. Verify the backend service.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (matId) => {
    if (!window.confirm('Are you sure you want to delete this material and remove it from vector index?')) return;
    try {
      await api.delete(`/api/reference-materials/${matId}`);
      fetchAllMaterials();
    } catch (err) {
      console.error('Failed to delete material', err);
    }
  };

  const handleAskAI = (matTitle) => {
    navigate('/ai-tutor', { state: { prefillQuery: `Explain key concepts from reference notes: "${matTitle}"` } });
  };

  // Group materials by Subject and Topic
  const groupedMaterials = materials.reduce((acc, m) => {
    const subName = m.subject_name || 'General';
    const topName = m.topic_name || 'General Topic';
    if (!acc[subName]) acc[subName] = {};
    if (!acc[subName][topName]) acc[subName][topName] = [];
    acc[subName][topName].push(m);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto font-sans pb-6">
      
      {/* Upload Column */}
      <div className="p-6 sm:p-8 rounded-3xl flex flex-col justify-between" style={card}>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <h2 className="text-base font-extrabold flex items-center gap-2 text-[#1E1B18]">
              <Upload className="h-5 w-5 text-[#FF5A36]" /> Ingest Syllabus Material
            </h2>
            <p className="text-xs mt-1 text-[#4A443F]">Index private notes, PDFs, or PPTs for AI Tutor retrieval.</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Syllabus Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Syllabus Topic</label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              disabled={topics.length === 0}
              className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none disabled:opacity-50"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Material Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Memory Leak Notes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Material Ingestion Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            >
              <option value="text">Text Notes Input</option>
              <option value="pdf">PDF Document</option>
              <option value="docx">DOCX Word Document</option>
              <option value="pptx">PPTX Presentation</option>
            </select>
          </div>

          {type === 'text' ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Notes Content</label>
              <textarea
                rows={4}
                required
                placeholder="Paste or write reference notes here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Select Document File</label>
              <input
                type="file"
                required
                ref={fileInputRef}
                onChange={(e) => setFile(e.target.files[0])}
                accept={type === 'pdf' ? '.pdf' : type === 'docx' ? '.docx' : '.pptx'}
                className="w-full text-xs text-[#1E1B18] cursor-pointer"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !selectedTopicId}
            className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-[#FF5A36] text-white hover:bg-[#E04826] transition-all shadow-md disabled:opacity-50 mt-2"
          >
            {uploading ? 'Processing & Chunking...' : 'Create Reference Material'}
          </button>
        </form>
      </div>

      {/* Catalog Display Column */}
      <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl flex flex-col justify-between" style={card}>
        <div className="space-y-6 flex-1 flex flex-col">
          <div>
            <h2 className="text-base font-extrabold flex items-center gap-2 text-[#1E1B18]">
              <Folder className="h-5 w-5 text-[#FF5A36]" /> Reference Materials Catalog
            </h2>
            <p className="text-xs mt-1 text-[#4A443F]">Explore your syllabus references. Open, review, or ask the AI Tutor questions about them.</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] pr-2 space-y-5">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]"></div>
              </div>
            ) : Object.keys(groupedMaterials).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-xs italic text-[#786F68]">
                <FileText className="h-10 w-10 text-[#FF5A36] opacity-30 mb-2" />
                No reference materials indexed yet. Upload documents or write notes on the left.
              </div>
            ) : (
              Object.entries(groupedMaterials).map(([subName, subTopics]) => (
                <div key={subName} className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#FF5A36] border-b border-[#F3E8E2] pb-1">
                    {subName}
                  </h3>
                  
                  <div className="pl-3 space-y-4">
                    {Object.entries(subTopics).map(([topicName, mats]) => (
                      <div key={topicName} className="space-y-2">
                        <p className="text-xs font-extrabold text-[#1E1B18]">
                          📁 {topicName}
                        </p>
                        
                        <div className="pl-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {mats.map((m) => (
                            <div key={m.id} className="p-4 rounded-2xl space-y-3 flex flex-col justify-between bg-[#FFF9F6] border border-[#E8D8CF]">
                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <p className="text-xs font-extrabold truncate text-[#1E1B18]" title={m.title}>{m.title}</p>
                                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9]">
                                    {m.type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#786F68] mt-1">
                                  Uploaded: {new Date(m.uploaded_at).toLocaleDateString()}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <div className={`h-2 w-2 rounded-full ${
                                    m.vector_status === 'processed' ? 'bg-emerald-500' :
                                    m.vector_status === 'failed' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'
                                  }`}></div>
                                  <span className="text-[10px] capitalize text-[#4A443F] font-semibold">{m.vector_status || 'pending'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-2 border-t border-[#F3E8E2]">
                                {m.file_path && (
                                  <>
                                    <a
                                      href={`http://localhost:8000/api/reference-materials/${m.id}/download`}
                                      download={`${(m.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
                                      title="Download Genuine PDF Document"
                                      className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E8D8CF] text-[#FF5A36] hover:bg-[#FFF0EB] transition-all flex items-center gap-1.5 text-xs font-bold"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      <span>Download PDF</span>
                                    </a>
                                    <a href={`http://localhost:8000/uploads/reference_materials/${m.file_path.split(/[\\/]/).pop()}`}
                                      target="_blank" rel="noopener noreferrer" title="Open in Browser"
                                      className="p-2 rounded-xl bg-white border border-[#E8D8CF] text-[#1E1B18] hover:bg-[#FFF0EB] transition-all">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </>
                                )}
                                <button onClick={() => handleAskAI(m.title)} title="Ask AI about notes"
                                  className="p-2 rounded-xl bg-[#FFF0EB] border border-[#FFE4D9] text-[#FF5A36] hover:bg-[#FFE4D9] transition-all">
                                  <Sparkles className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDelete(m.id)} title="Delete Material"
                                  className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-all ml-auto">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceMaterials;
