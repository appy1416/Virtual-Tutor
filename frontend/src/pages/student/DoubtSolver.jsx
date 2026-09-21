import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { 
  Send, Mic, Square, Paperclip, CheckCircle, FileText, MessageSquare, Volume2, Plus, Bot, User, Trash2
} from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };

const DoubtSolver = () => {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState('');

  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopics(selectedSubjectId);
    } else {
      setTopics([]);
      setSelectedTopicId('');
      setSubtopics([]);
      setSelectedSubtopic('');
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedTopicId) {
      const topicObj = topics.find((t) => t.id === selectedTopicId);
      if (topicObj && topicObj.subtopics) {
        setSubtopics(topicObj.subtopics);
        if (topicObj.subtopics.length > 0) {
          setSelectedSubtopic(topicObj.subtopics[0]);
        } else {
          setSelectedSubtopic('');
        }
      } else {
        setSubtopics([]);
        setSelectedSubtopic('');
      }
      fetchMaterials(selectedSubjectId, selectedTopicId);
    } else {
      setSubtopics([]);
      setSelectedSubtopic('');
      setMaterials([]);
    }
  }, [selectedTopicId, topics]);

  const fetchInitialData = async () => {
    try {
      const res = await api.get('/api/subjects');
      setSubjects(res.data || []);
      if (res.data?.length > 0) {
        setSelectedSubjectId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial subjects', err);
    }
  };

  const fetchTopics = async (subjectId) => {
    try {
      const res = await api.get(`/api/subjects/${subjectId}/topics`);
      setTopics(res.data || []);
      if (res.data?.length > 0) {
        setSelectedTopicId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load topics', err);
    }
  };

  const fetchMaterials = async (subId, topId) => {
    try {
      const res = await api.get(`/api/reference-materials?subject_id=${subId}&topic_id=${topId}`);
      setMaterials(res.data || []);
    } catch (err) {
      console.error('Failed to load materials', err);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file || !uploadTitle.trim() || !selectedSubjectId || !selectedTopicId) return;
    setUploading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    const matType = ['pdf', 'pptx', 'docx', 'png', 'jpg', 'jpeg'].includes(ext) ? (['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : ext) : 'pdf';
    const formData = new FormData();
    formData.append('subject_id', selectedSubjectId);
    formData.append('topic_id', selectedTopicId);
    formData.append('title', uploadTitle);
    formData.append('type', matType);
    formData.append('file', file);
    try {
      await api.post('/api/reference-materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadTitle('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchMaterials(selectedSubjectId, selectedTopicId);
    } catch (err) {
      console.error('Failed to upload material', err);
      alert(err?.response?.data?.detail || 'Upload failed. Verify backend.');
    } finally {
      setUploading(false);
    }
  };

  const recognitionRef = useRef(null);
  const [micStatus, setMicStatus] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading || !selectedSubjectId || !selectedTopicId) return;
    const userQuery = query;
    setQuery('');
    setChatLog((prev) => [...prev, { role: 'user', content: userQuery }]);
    setLoading(true);

    const activeSub = subjects.find((s) => s.id === selectedSubjectId)?.name;
    const activeTop = topics.find((t) => t.id === selectedTopicId)?.name;

    try {
      const res = await api.post('/api/study/doubt', {
        subject_id: selectedSubjectId,
        topic_id: selectedTopicId,
        subtopic: selectedSubtopic || null,
        subject: activeSub,
        topic: activeTop,
        query: userQuery
      });
      setChatLog((prev) => [
        ...prev,
        {
          role: 'tutor',
          content: res.data.response || res.data.response_text,
          citations: res.data.citations,
          youtube_resources: res.data.youtube_resources
        }
      ]);
    } catch (err) {
      console.error('Doubt solving failed', err);
      setChatLog((prev) => [
        ...prev,
        { role: 'tutor', content: 'Failed to retrieve response from AI Tutor. Please verify the backend.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeechRecognition = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone recording is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setMicStatus('🎙️ Listening... Speak your doubt clearly. Click mic when finished.');
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size < 400) {
          setMicStatus('No speech detected. Please speak clearly into your microphone.');
          setTimeout(() => setMicStatus(''), 3000);
          return;
        }

        setMicStatus('⚡ Transcribing speech with Whisper AI...');
        try {
          const formData = new FormData();
          const ext = recorder.mimeType && recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
          formData.append('file', audioBlob, `recorded_speech.${ext}`);

          const res = await api.post('/api/ai-tutor/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data && res.data.text) {
            setQuery((prev) => (prev ? `${prev} ${res.data.text}` : res.data.text));
            setMicStatus('✅ Transcribed successfully!');
            setTimeout(() => setMicStatus(''), 2500);
          } else {
            setMicStatus('Could not transcribe audio. Please try again.');
            setTimeout(() => setMicStatus(''), 3500);
          }
        } catch (err) {
          console.error('Whisper transcription error:', err);
          const errorMsg = err.response?.data?.detail || 'Failed to transcribe audio. Please try again.';
          setMicStatus(`Transcription error: ${errorMsg}`);
          setTimeout(() => setMicStatus(''), 4500);
        }
      };

      recorder.start(250);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      setIsRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings.');
        setMicStatus('Microphone access denied.');
      } else {
        setMicStatus(`Microphone error: ${err.message || 'Could not access mic'}`);
      }
      setTimeout(() => setMicStatus(''), 3500);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[calc(100vh-8rem)] font-sans pb-6">
      {/* Chat Column */}
      <div className="lg:col-span-2 rounded-3xl flex flex-col justify-between overflow-hidden" style={card}>
        {/* Chat Header with Subject/Topic/Subtopic filters */}
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#F3E8E2] bg-[#FFF9F6]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF5A36] text-white shadow-md">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#1E1B18]">Interactive Doubt Solver</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-white border border-[#E8D8CF] text-[#1E1B18] text-xs font-semibold px-3 py-1.5 rounded-xl focus:outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>

            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              disabled={topics.length === 0}
              className="bg-white border border-[#E8D8CF] text-[#1E1B18] text-xs font-semibold px-3 py-1.5 rounded-xl focus:outline-none disabled:opacity-50"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              value={selectedSubtopic}
              onChange={(e) => setSelectedSubtopic(e.target.value)}
              disabled={subtopics.length === 0}
              className="bg-white border border-[#E8D8CF] text-[#1E1B18] text-xs font-semibold px-3 py-1.5 rounded-xl focus:outline-none disabled:opacity-50"
            >
              {subtopics.map((sub, i) => (
                <option key={i} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[480px] bg-[#FFF9F6]">
          {chatLog.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <MessageSquare className="h-10 w-10 mx-auto text-[#FF5A36] opacity-30" />
              <p className="text-xs font-semibold text-[#786F68]">
                Select subject/topic filters and ask any question or use the mic to speak with your AI Tutor.
              </p>
            </div>
          ) : (
            chatLog.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed font-medium ${
                    msg.role === 'user'
                      ? 'bg-[#FF5A36] text-white rounded-br-none shadow-md'
                      : 'bg-white text-[#1E1B18] border border-[#E8D8CF] rounded-bl-none shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.role === 'tutor' && msg.audioUrl && (
                    <div className="mt-3 pt-3 flex items-center gap-2 text-xs font-bold border-t border-[#F3E8E2] text-[#FF5A36]">
                      <Volume2 className="h-4 w-4 animate-bounce" />
                      Tutor is speaking...
                      <audio controls src={`http://localhost:8000${msg.audioUrl}`} className="h-6 w-40 ml-2" />
                    </div>
                  )}

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 space-y-1.5 border-t border-[#F3E8E2]">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#786F68]">Source References:</p>
                      {msg.citations.map((cit, idx) => (
                        <div key={idx} className="text-xs flex items-center gap-1.5 p-2 rounded-xl bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18]">
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#FF5A36]" />
                          <span>{cit.material_title} (Page {cit.page_number})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.youtube_resources && msg.youtube_resources.length > 0 && (
                    <div className="mt-3 pt-3 space-y-2 border-t border-[#F3E8E2]">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#FF5A36] flex items-center gap-1">
                        <span>▶</span> Recommended Video Lessons:
                      </p>
                      {msg.youtube_resources.map((yt, idx) => (
                        <a
                          key={idx}
                          href={yt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9F6] border border-[#E8D8CF] hover:border-[#FF5A36] text-[#1E1B18] transition-all group"
                        >
                          <span className="group-hover:text-[#FF5A36] transition-colors">{yt.title}</span>
                          <span className="text-[10px] uppercase font-black text-[#FF5A36] bg-[#FFF0EB] px-2 py-0.5 rounded border border-[#FFE4D9] shrink-0">
                            Open Video ↗
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#786F68]">
              <div className="animate-bounce h-2 w-2 rounded-full bg-[#FF5A36]"></div>
              <div className="animate-bounce h-2 w-2 rounded-full bg-[#FF5A36] [animation-delay:150ms]"></div>
              <div className="animate-bounce h-2 w-2 rounded-full bg-[#FF5A36] [animation-delay:300ms]"></div>
              Tutor is formulating response...
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="border-t border-[#F3E8E2] bg-white">
          {micStatus && (
            <div className="px-4 py-1.5 text-[11px] font-bold text-[#FF5A36] bg-[#FFF0EB] border-b border-[#FFE4D9] flex items-center justify-between animate-pulse">
              <span>{micStatus}</span>
              {isRecording && (
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className="underline text-[10px] text-rose-600 hover:text-rose-700"
                >
                  Stop Recording
                </button>
              )}
            </div>
          )}
          <form onSubmit={handleSend} className="p-4 flex gap-3">
            <input
              type="text"
              placeholder="Ask a doubt about selected topic..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl text-xs sm:text-sm font-semibold text-[#1E1B18] placeholder-[#786F68] focus:outline-none"
            />
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={loading}
                title={isRecording ? 'Stop Recording' : 'Speak your question'}
                className={`p-3 rounded-2xl transition-all shadow-sm ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-[#FFF9F6] border border-[#E8D8CF] text-[#786F68] hover:text-[#1E1B18] hover:border-[#FF5A36]'
                }`}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="p-3.5 rounded-2xl bg-[#FF5A36] text-white hover:bg-[#E04826] transition-all disabled:opacity-40 shadow-md"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Materials Side Panel */}
      <div className="p-5 sm:p-6 rounded-3xl flex flex-col gap-5 h-[580px] overflow-hidden" style={card}>
        <div>
          <h3 className="text-sm font-extrabold flex items-center gap-2 text-[#1E1B18]">
            <Paperclip className="h-4 w-4 text-[#FF5A36]" /> Reference Materials
          </h3>
          <p className="text-xs mt-0.5 text-[#786F68]">Upload notes or review syllabus slides.</p>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleFileUpload} className="p-4 rounded-2xl space-y-3 bg-[#FFF9F6] border border-[#E8D8CF]">
          <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-[#FF5A36]">
            <Plus className="h-3.5 w-3.5" /> Add Note / PDF
          </p>
          <input
            type="text"
            placeholder="Note Title (e.g. Midterm prep)"
            required
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#E8D8CF] rounded-xl text-xs font-semibold text-[#1E1B18] placeholder-[#786F68] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <input type="file" required ref={fileInputRef} onChange={(e) => setFile(e.target.files[0])}
              accept=".pdf,.docx,.pptx,.txt" className="hidden" id="private-note-file" />
            <label htmlFor="private-note-file"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer truncate max-w-[130px] bg-white border border-[#E8D8CF] text-[#1E1B18]">
              <Paperclip className="h-3 w-3 text-[#FF5A36]" />
              <span className="truncate">{file ? file.name : 'Select File'}</span>
            </label>
            <button type="submit" disabled={uploading || !file || !uploadTitle.trim() || !selectedTopicId}
              className="text-white font-bold text-xs px-3 py-1.5 rounded-xl bg-[#FF5A36] hover:bg-[#E04826] transition-all disabled:opacity-50 shadow-sm">
              {uploading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        {/* Materials List */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#786F68]">Active Syllabus Sources</p>
          {materials.length === 0 ? (
            <p className="text-xs italic text-[#786F68]">No slides or references found for this topic.</p>
          ) : (
            materials.map((m) => (
              <div key={m.id} className="p-3.5 rounded-2xl space-y-2 bg-[#FFF9F6] border border-[#E8D8CF]">
                <div className="flex items-start gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 mt-0.5 text-[#FF5A36]" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-extrabold truncate text-[#1E1B18]" title={m.title}>{m.title}</p>
                    <p className="text-[10px] capitalize text-[#786F68]">{m.type} • Indexed</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoubtSolver;
