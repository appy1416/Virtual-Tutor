import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { 
  Plus, BookOpen, FileText, Upload, Sparkles, AlertCircle, CheckCircle, Trash2, ArrowRight
} from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E8D8CF',
  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
};

const CourseCreator = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Java');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Material upload states
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialType, setMaterialType] = useState('text');
  const [noteContent, setNoteContent] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/api/courses');
      setCourses(res.data || []);
      if (res.data?.length > 0 && !selectedCourseId) {
        setSelectedCourseId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load courses', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/courses', { title, subject, description });
      setSuccess(`Course '${res.data.title}' created successfully!`);
      setTitle('');
      setDescription('');
      fetchCourses();
      if (!selectedCourseId) {
        setSelectedCourseId(res.data.id);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create course. Verify the backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMaterialUpload = async (e) => {
    e.preventDefault();
    if (!selectedCourseId || !materialTitle.trim()) return;
    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('title', materialTitle);
    formData.append('type', materialType);

    if (materialType === 'text') {
      formData.append('content', noteContent);
    } else {
      if (!uploadFile) {
        setError('Please select a file to upload.');
        setUploading(false);
        return;
      }
      formData.append('file', uploadFile);
    }

    try {
      await api.post(`/api/courses/${selectedCourseId}/materials`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('Syllabus material uploaded and indexed successfully!');
      setMaterialTitle('');
      setNoteContent('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to upload material.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto font-sans pb-6">
      
      {/* Course Creator Form Column */}
      <div className="p-6 sm:p-8 rounded-3xl flex flex-col gap-5" style={cardStyle}>
        <div>
          <h2 className="text-base font-black flex items-center gap-2 text-[#1E1B18]">
            <Plus className="h-5 w-5 text-[#FF5A36]" /> Create New Syllabus Course
          </h2>
          <p className="text-xs mt-1 text-[#4A443F]">Initialize a new subject track for AI Tutoring alignment.</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Course Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Advanced Java Concepts"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Syllabus Subject Area</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            >
              <option value="Java">Java Programming</option>
              <option value="Python">Python Programming</option>
              <option value="Data Structures">Data Structures</option>
              <option value="DBMS">DBMS</option>
              <option value="Computer Networks">Computer Networks</option>
              <option value="Operating Systems">Operating Systems</option>
              <option value="Machine Learning">Machine Learning</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Course Description</label>
            <textarea
              rows={3}
              required
              placeholder="Overview of syllabus concepts and target topics..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-[#FF5A36] text-white text-xs font-black uppercase tracking-wider hover:bg-[#E04826] transition-all shadow-md disabled:opacity-50 mt-2"
          >
            {submitting ? 'Creating Course...' : 'Publish Course'}
          </button>
        </form>
      </div>

      {/* Material Upload Column */}
      <div className="p-6 sm:p-8 rounded-3xl flex flex-col gap-5" style={cardStyle}>
        <div>
          <h2 className="text-base font-black flex items-center gap-2 text-[#1E1B18]">
            <Upload className="h-5 w-5 text-[#FF5A36]" /> Ingest Syllabus Content
          </h2>
          <p className="text-xs mt-1 text-[#4A443F]">Upload PDF notes or raw text for AI RAG indexing.</p>
        </div>

        <form onSubmit={handleMaterialUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Target Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            >
              <option value="" disabled>-- Select Existing Course --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.subject})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Material Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Chapter 1: Multithreading Notes"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Format</label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
            >
              <option value="text">Direct Text / Markdown</option>
              <option value="pdf">PDF / Slide File</option>
            </select>
          </div>

          {materialType === 'text' ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Notes Text</label>
              <textarea
                rows={4}
                required
                placeholder="Paste key formulas, notes, or code..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Attach File</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="w-full text-xs text-[#1E1B18] cursor-pointer"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !selectedCourseId}
            className="w-full py-4 rounded-2xl bg-[#FF5A36] text-white text-xs font-black uppercase tracking-wider hover:bg-[#E04826] transition-all shadow-md disabled:opacity-50 mt-2"
          >
            {uploading ? 'Ingesting Material...' : 'Ingest & Index Material'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CourseCreator;
