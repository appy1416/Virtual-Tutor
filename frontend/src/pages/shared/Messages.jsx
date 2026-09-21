import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Paperclip, User, Search, CheckCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Messages = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/api/messages/contacts');
      setContacts(res.data || []);
      if (res.data && res.data.length > 0 && !selectedContact) {
        setSelectedContact(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchChat = async (contactId) => {
    if (!contactId) return;
    setLoadingChat(true);
    try {
      const res = await api.get(`/api/messages/chat/${contactId}`);
      setMessages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (selectedContact) {
      fetchChat(selectedContact.id);
      const interval = setInterval(() => fetchChat(selectedContact.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !selectedContact) return;

    const formData = new FormData();
    formData.append('receiver_id', selectedContact.id);
    formData.append('message_text', inputText.trim() || 'Sent attachment');
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    try {
      const res = await api.post('/api/messages/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessages((prev) => [...prev, res.data]);
      setInputText('');
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full w-full flex-1 flex flex-col md:flex-row rounded-3xl border border-[#E8D8CF] bg-white shadow-sm overflow-hidden font-sans min-h-0">
      
      {/* Contact List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-[#F3E8E2] flex flex-col bg-[#FFF9F6] h-48 md:h-full shrink-0 min-h-0">
        <div className="p-4 border-b border-[#F3E8E2] shrink-0">
          <h2 className="text-sm font-extrabold text-[#1E1B18] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#FF5A36]" />
            Direct Messages
          </h2>
          <p className="text-[11px] text-[#786F68] mt-1 font-medium">
            {user.role === 'student' ? 'Assigned Faculty' : 'Class Enrolled Students'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 overscroll-contain">
          {loadingContacts ? (
            <div className="text-center text-xs text-[#786F68] py-8">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center text-xs text-[#786F68] py-8">No active contacts found.</div>
          ) : (
            contacts.map((c) => {
              const isSelected = selectedContact?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border ${
                    isSelected
                      ? 'bg-white border-[#FF5A36] text-[#1E1B18] shadow-sm'
                      : 'bg-transparent border-transparent text-[#4A443F] hover:bg-white hover:border-[#E8D8CF]'
                  }`}
                >
                  <div className="h-9 w-9 rounded-xl bg-[#FF5A36] text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {c.name ? c.name.charAt(0) : 'U'}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <h4 className="text-xs font-bold truncate text-[#1E1B18]">{c.name}</h4>
                    <p className="text-[10px] text-[#786F68] truncate">{c.class_name || c.email}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-[#F3E8E2] flex items-center justify-between bg-[#FFF9F6] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#FF5A36] text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                  {selectedContact.name ? selectedContact.name.charAt(0) : 'U'}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1E1B18]">{selectedContact.name}</h3>
                  <p className="text-[10px] text-[#786F68] capitalize font-medium">{selectedContact.role} • {selectedContact.email}</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFF9F6] min-h-0 overscroll-contain">
              {loadingChat && messages.length === 0 ? (
                <div className="text-center text-xs text-[#786F68] py-8">Loading chat history...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-[#786F68] py-12">No messages yet. Send a message to start the conversation!</div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] p-3.5 rounded-2xl text-xs space-y-1 ${
                          isMe
                            ? 'bg-[#FF5A36] text-white rounded-br-none shadow-md font-medium'
                            : 'bg-white text-[#1E1B18] border border-[#E8D8CF] rounded-bl-none shadow-sm font-medium'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.message_text}</p>
                        {m.attachment_url && (
                          <a
                            href={`http://localhost:8000${m.attachment_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-block mt-2 px-3 py-1.5 rounded-xl text-[11px] font-bold underline ${
                              isMe ? 'bg-black/20 text-white' : 'bg-[#FFF0EB] text-[#FF5A36]'
                            }`}
                          >
                            📎 Attachment File
                          </a>
                        )}
                      </div>
                      <span className="text-[9px] text-[#786F68] mt-1 px-1">
                        {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-[#F3E8E2] bg-white flex items-center gap-2 shrink-0">
              <label className="p-2.5 rounded-xl bg-[#FFF9F6] text-[#786F68] hover:text-[#1E1B18] cursor-pointer border border-[#E8D8CF] transition-all">
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </label>

              {selectedFile && (
                <span className="text-[10px] text-[#FF5A36] font-bold bg-[#FFF0EB] border border-[#FFE4D9] px-2.5 py-1 rounded-xl truncate max-w-[120px]">
                  {selectedFile.name}
                </span>
              )}

              <input
                type="text"
                placeholder={`Message ${selectedContact.name}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl px-4 py-2.5 text-xs text-[#1E1B18] placeholder-[#786F68] focus:outline-none"
              />

              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-[#FF5A36] text-white text-xs font-bold hover:bg-[#E04826] transition-all flex items-center gap-1.5 shadow-md"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[#786F68]">
            Select a contact to view conversation.
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
