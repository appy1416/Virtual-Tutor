import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { Send, Sparkles, AlertCircle, Bot, User, Paperclip, X, FileText, Image as ImageIcon, Mic, Square } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #F3E8E2',
  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
};

const AITutor = () => {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    if (location.state && location.state.prefillQuery) {
      triggerSearch(location.state.prefillQuery);
    } else {
      setChatLog([
        {
          sender: 'ai',
          type: 'greeting',
          content: 'Hello! I am your AI Virtual Tutor. What educational topic, question, or document would you like to explore today? You can also upload notes or problem images!'
        }
      ]);
    }
  }, [location.state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, loading]);

  const triggerSearch = async (textToSearch, fileToSend = null) => {
    if (!textToSearch.trim() && !fileToSend) return;
    const promptText = textToSearch.trim() || (fileToSend ? `Analyze attached file: ${fileToSend.name}` : '');
    const userMessage = {
      sender: 'user',
      content: promptText,
      fileName: fileToSend ? fileToSend.name : null,
      fileType: fileToSend ? fileToSend.type : null
    };
    setChatLog((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let res;
      if (fileToSend) {
        const formData = new FormData();
        formData.append('question', promptText);
        formData.append('file', fileToSend);
        res = await api.post('/api/ai-tutor/ask', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        res = await api.post('/api/ai-tutor/ask', { question: promptText });
      }

      setChatLog((prev) => [
        ...prev,
        {
          sender: 'ai',
          type: 'structured',
          explanation: res.data.explanation,
          example: res.data.example,
          important_points: res.data.important_points
        }
      ]);
    } catch (err) {
      console.error('AI Tutor call failed', err);
      setChatLog((prev) => [
        ...prev,
        {
          sender: 'ai',
          type: 'error',
          content: err.response?.data?.detail || 'Sorry, I failed to process that request. Please verify the backend and check if the API key is configured.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert('File size exceeds 20MB limit.');
        return;
      }
      setAttachedFile(file);
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
        setMicStatus('🎙️ Listening... Speak your question clearly. Click mic when finished.');
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

  const handleSend = (e) => {
    e.preventDefault();
    if ((!query.trim() && !attachedFile) || loading) return;
    const text = query;
    const file = attachedFile;
    setQuery('');
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    triggerSearch(text, file);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-7rem)] font-sans">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-1 mb-4">
        <div className="p-2.5 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1E1B18]">AI Virtual Tutor</h1>
          <p className="text-xs font-medium text-[#4A443F]">Get instant explanations, code samples, and key takeaways.</p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 rounded-3xl flex flex-col min-h-0 overflow-hidden" style={cardStyle}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#FFF9F6]">
          {chatLog.map((msg, idx) => {
            if (msg.sender === 'user') {
              return (
                <div key={idx} className="flex justify-end items-end gap-2.5">
                  <div
                    className="max-w-[80%] px-4.5 py-3 rounded-2xl rounded-br-sm text-sm font-semibold leading-relaxed bg-[#FF5A36] text-white shadow-md space-y-1.5"
                  >
                    {msg.fileName && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-mono w-fit">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[200px]">{msg.fileName}</span>
                      </div>
                    )}
                    <div>{msg.content}</div>
                  </div>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-[#FFF0EB] border border-[#E8D8CF]">
                    <User className="h-4 w-4 text-[#FF5A36]" />
                  </div>
                </div>
              );
            }

            if (msg.type === 'greeting') {
              return (
                <div key={idx} className="flex gap-3 items-end">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-[#FF5A36] text-white shadow-sm">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[80%] px-4.5 py-3.5 rounded-2xl rounded-bl-sm text-sm font-semibold leading-relaxed bg-white border border-[#E8D8CF] text-[#1E1B18] shadow-sm">
                    {msg.content}
                  </div>
                </div>
              );
            }

            if (msg.type === 'error') {
              return (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-rose-100 border border-rose-200">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                  </div>
                  <div className="max-w-[80%] px-4.5 py-3.5 rounded-2xl rounded-bl-sm text-sm font-semibold leading-relaxed bg-rose-50 border border-rose-200 text-rose-800">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-[#FF5A36] text-white shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>

                <div className="max-w-[88%] sm:max-w-[84%] rounded-3xl rounded-bl-sm p-6 space-y-5 min-w-0 bg-white border border-[#E8D8CF] shadow-sm text-[#1E1B18]">

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-4 rounded-full bg-[#FF5A36]"></div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF5A36]">Explanation</h4>
                    </div>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-line text-[#1E1B18]">
                      {msg.explanation}
                    </p>
                  </div>

                  <div className="h-px bg-[#F3E8E2]"></div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-4 rounded-full bg-[#FF5A36]"></div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF5A36]">Example</h4>
                    </div>
                    <pre
                      className="p-4 rounded-2xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed bg-[#1E1B18] text-[#4ADE80]"
                    >
                      {msg.example}
                    </pre>
                  </div>

                  <div className="h-px bg-[#F3E8E2]"></div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-4 rounded-full bg-[#FF5A36]"></div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF5A36]">Key Takeaways</h4>
                    </div>
                    <ul className="space-y-2">
                      {msg.important_points && msg.important_points.map((pt, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-[#1E1B18]">
                          <span className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9]">
                            {pIdx + 1}
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 items-end">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-[#FF5A36] text-white">
                <Bot className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div className="px-5 py-4 rounded-2xl rounded-bl-sm flex items-center gap-2 bg-white border border-[#E8D8CF]">
                <span className="h-2 w-2 rounded-full animate-bounce bg-[#FF5A36]" style={{ animationDelay: '0ms' }}></span>
                <span className="h-2 w-2 rounded-full animate-bounce bg-[#FF5A36]" style={{ animationDelay: '150ms' }}></span>
                <span className="h-2 w-2 rounded-full animate-bounce bg-[#FF5A36]" style={{ animationDelay: '300ms' }}></span>
                <span className="text-xs font-semibold ml-1 text-[#4A443F]">Composing explanation...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Form with Attachment and Voice Support */}
        <div className="shrink-0 p-4 bg-white border-t border-[#F3E8E2]">
          {micStatus && (
            <div className="mb-3 px-4 py-1.5 text-[11px] font-bold text-[#FF5A36] bg-[#FFF0EB] border border-[#FFE4D9] rounded-xl flex items-center justify-between animate-pulse">
              <span>{micStatus}</span>
              {isRecording && (
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className="underline text-[10px] text-rose-600 hover:text-rose-700 font-semibold"
                >
                  Stop Recording
                </button>
              )}
            </div>
          )}
          {attachedFile && (
            <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#FFF0EB] border border-[#FFE4D9] text-xs font-medium text-[#1E1B18] w-fit max-w-full">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-[#FF5A36] shrink-0" />
                <span className="truncate">{attachedFile.name}</span>
                <span className="text-[#786F68] text-[10px]">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-2 p-1 text-[#786F68] hover:text-[#1E1B18] rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 sm:gap-3 items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Attach notes, problem image, or document (PDF, PNG, JPG, DOCX up to 20MB)"
              className="p-3.5 rounded-2xl border border-[#E8D8CF] text-[#786F68] hover:text-[#FF5A36] hover:bg-[#FFF0EB] transition-colors disabled:opacity-40 shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleSpeechRecognition}
              disabled={loading}
              title={isRecording ? 'Stop Recording' : 'Speak your question with Whisper'}
              className={`p-3.5 rounded-2xl transition-all shadow-sm shrink-0 ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'border border-[#E8D8CF] text-[#786F68] hover:text-[#FF5A36] hover:bg-[#FFF0EB]'
              }`}
            >
              {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              type="text"
              placeholder={attachedFile ? "Ask a question about this file... (or press Send)" : "Ask a question… e.g. Explain Binary Search"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="flex-1 px-4.5 py-3.5 rounded-2xl text-sm font-semibold text-[#1E1B18] bg-[#FFF9F6] border border-[#E8D8CF] focus:outline-none placeholder-[#786F68]"
            />

            <button
              type="submit"
              disabled={loading || (!query.trim() && !attachedFile)}
              className="px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-40 shrink-0 bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-md"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AITutor;
