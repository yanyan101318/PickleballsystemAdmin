import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { Toaster, toast } from "react-hot-toast";
import MessageOptionsMenu from "../components/chat/MessageOptionsMenu";
import { Pin, Paperclip, Loader2, X } from "lucide-react";

const API_BASE = "/api";
const socket = io("http://localhost:3000", { autoConnect: false });

export default function AdminChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [isLoadingWidget, setIsLoadingWidget] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Image Attachment State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();

  const isSupportPage = location.pathname === "/admin/support";

  // Initial fetch for chats and socket setup
  useEffect(() => {
    if (isSupportPage) return;
    
    const fetchChats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/chats/admin/chats`);
        setChats(res.data || []);
      } catch (err) {
        console.error("Error fetching chats:", err);
      }
    };
    
    fetchChats();
    socket.connect();
    socket.emit('joinAdmin');

    const handleMessageCreated = (msg) => {
      setChats(prev => {
        let exists = prev.find(c => c.id === msg.chatId);
        if (exists) {
          return prev.map(c => c.id === msg.chatId ? { ...c, lastMessage: msg.text || "Sent an image", unreadByAdmin: true } : c);
        } else {
          // If new chat, fetch full list to get names etc
          fetchChats();
          return prev;
        }
      });
      
      setMessages(prev => {
        if (msg.chatId === activeChatId) {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    const handleMessageEdited = (updated) => {
      setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text, isEdited: true } : m));
    };

    const handleMessageDeleted = ({ id, chatId }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, text: "This message was deleted", image: null, isDeleted: true } : m));
    };

    const handleMessagePinned = ({ id, chatId, isPinned }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isPinned } : m));
    };

    const handleMessageReacted = ({ id, chatId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, reactions } : m));
    };

    socket.on('messageCreated', handleMessageCreated);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messagePinned', handleMessagePinned);
    socket.on('messageReacted', handleMessageReacted);

    return () => {
      socket.off('messageCreated', handleMessageCreated);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messagePinned', handleMessagePinned);
      socket.off('messageReacted', handleMessageReacted);
    };
  }, [isSupportPage, activeChatId]);

  // Fetch messages when active chat changes
  useEffect(() => {
    if (!isOpen || !activeChatId || isSupportPage) return;
    
    const fetchMessages = async () => {
      setIsLoadingWidget(true);
      try {
        const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
        setMessages(res.data?.messages || res.data || []);
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setIsLoadingWidget(false);
      }
    };
    
    fetchMessages();
  }, [isOpen, activeChatId, isSupportPage]);

  // Mark as read
  useEffect(() => {
    if (!isOpen || !activeChatId || isSupportPage) return;
    const markAsRead = async () => {
      try {
        await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/mark-read`);
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, unreadByAdmin: false } : c));
      } catch (err) {
        console.error("Error marking chat as read:", err);
      }
    };
    markAsRead();
  }, [isOpen, activeChatId, isSupportPage]);

  // Scroll to bottom of messages only on new message
  useEffect(() => {
    if (isOpen && activeChatId) {
      if (messages.length > prevMessagesLength.current || prevMessagesLength.current === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isOpen, activeChatId]);

  useEffect(() => {
    prevMessagesLength.current = 0;
  }, [activeChatId]);

  // Image Handling
  const processFile = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast.error('Image size must be less than 2MB');
      return;
    }
    
    setIsConverting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImageFile(file);
      setIsConverting(false);
    };
    reader.onerror = () => {
      toast.error('Error reading file');
      setIsConverting(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e) => {
    const file = e.clipboardData.files?.[0];
    if (file) {
      e.preventDefault();
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };


  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!activeChatId || (!replyText.trim() && !imagePreview)) return;
    try {
      if (editingMessage) {
        await axios.put(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${editingMessage.id}`, { text: replyText.trim() });
        setEditingMessage(null);
      } else {
        await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`, {
          text: replyText.trim(),
          senderName: "Admin",
          image: imagePreview
        });
      }
      setReplyText("");
      setImagePreview(null);
      setImageFile(null);
      
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      setMessages(res.data?.messages || res.data || []);
    } catch (err) {
      toast.error("Failed to send reply");
    }
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm || !activeChatId) return;
    try {
      await axios.delete(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${showDeleteConfirm}`);
      setShowDeleteConfirm(null);
      toast.success("Message deleted");
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      setMessages(res.data?.messages || res.data || []);
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handlePin = async (msgId) => {
    try {
      await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${msgId}/pin`);
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      setMessages(res.data?.messages || res.data || []);
    } catch (err) {
      toast.error("Failed to pin message");
    }
  };

  const handleReact = async (msgId, emoji) => {
    try {
      await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${msgId}/react`, { emoji });
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      setMessages(res.data?.messages || res.data || []);
    } catch (err) {
      toast.error("Failed to react");
    }
  };

  const handleExpand = () => {
    setIsOpen(false);
    navigate("/admin/support");
  };

  const handleChatSelect = (id) => {
    if (activeChatId === id) return;
    setMessages([]);
    setActiveChatId(id);
  };

  if (isSupportPage) return null;

  const totalUnread = chats.filter(c => c.unreadByAdmin).length;
  const activeChat = chats.find(c => c.id === activeChatId);
  const pinnedMessages = messages.filter(m => m.isPinned);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      <Toaster position="top-center" />
      
      {isOpen && (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mb-4 w-[360px] h-[520px] bg-[#151e2d] border ${isDragging ? 'border-cyan-500' : 'border-slate-700'} rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all transform origin-bottom-right relative`}
        >
          
          {/* Drag Overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-[#0a0f18]/80 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-cyan-500 rounded-2xl pointer-events-none">
              <div className="text-white font-bold flex flex-col items-center gap-2">
                <Paperclip size={48} className="text-cyan-400" />
                <p>Drop image here to attach</p>
              </div>
            </div>
          )}

          <div className="h-14 bg-[#1c2636] border-b border-slate-700 flex items-center justify-between px-4 shrink-0 z-10">
            <div className="flex items-center gap-2">
              {activeChatId && (
                <button 
                  onClick={() => setActiveChatId(null)} 
                  className="text-slate-400 hover:text-white transition-colors mr-1"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
              )}
              <h3 className="font-bold text-white text-sm">
                {activeChatId ? (activeChat?.userName || "Customer") : "Support Chats"}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleExpand} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative bg-[#0a0f18]">
            {!activeChatId ? (
              <div className="h-full overflow-y-auto">
                {chats.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs font-medium">No active chats</div>
                ) : (
                  chats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => handleChatSelect(chat.id)}
                      className="w-full text-left p-3 border-b border-slate-800/50 hover:bg-slate-800/80 transition-colors flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0 border border-cyan-500/20">
                        <span className="text-cyan-400 font-bold text-sm">{(chat.userName || "U")[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="font-semibold text-slate-200 text-sm truncate pr-2">{chat.userName || "Unknown"}</h4>
                          {chat.unreadByAdmin && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{chat.lastMessage || "No messages"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full bg-[#0a0f18]">
                
                {pinnedMessages.length > 0 && (
                  <div className="bg-[#151e2d] border-b border-slate-700 p-2 flex gap-2 items-start text-xs z-10 shadow-md">
                    <Pin size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-slate-300 font-semibold mb-1">Pinned Message</p>
                      <p className="text-slate-400 truncate">{pinnedMessages[pinnedMessages.length - 1].text}</p>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#151e2d] to-[#0a0f18]">
                  {isLoadingWidget ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mb-3"></div>
                      <p className="text-sm font-medium">Loading chat...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <p className="text-xs">No messages yet.</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isAdmin = msg.senderName === "Admin" || msg.senderId === "admin";
                      const isDel = msg.isDeleted || msg.is_deleted;
                      const prevMsg = i > 0 ? messages[i-1] : null;
                      const isDuplicateDeletedGroup = isDel && msg.group_id && prevMsg?.group_id === msg.group_id && (prevMsg?.isDeleted || prevMsg?.is_deleted);
                      if (isDuplicateDeletedGroup) return null;

                      let time = "";
                      if (msg.createdAt) {
                        try {
                          time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        } catch (e) {}
                      }
                      
                      return (
                        <React.Fragment key={msg.id || i}>
                          {isDel ? (
                            <div className="w-full flex justify-center my-2">
                              <span className="text-slate-400/80 italic text-[11px] font-medium text-center bg-transparent px-3 py-1">
                                This message was deleted
                              </span>
                            </div>
                          ) : (
                            <div className={`flex group ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                              
                              {!isAdmin && (
                                <div className="flex items-center justify-center mr-1">
                                  <MessageOptionsMenu 
                                    message={msg} 
                                    isMe={isAdmin} 
                                    onDelete={() => setShowDeleteConfirm(msg.id)} // Admin can delete customer msgs
                                    onPin={() => handlePin(msg.id)}
                                    onReact={(emoji) => handleReact(msg.id, emoji)}
                                  />
                                </div>
                              )}

                          <div className="flex flex-col max-w-[85%] relative gap-1">
                            {msg.image && (
                              <div className={`rounded-2xl shadow-sm overflow-hidden ${msg.isDeleted ? 'opacity-60' : ''}`}>
                                <img 
                                  src={msg.image} 
                                  alt="Attachment" 
                                  className="max-w-full max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setLightboxImage(msg.image)}
                                />
                                {!msg.text && (
                                  <div className={`text-[9px] mt-1 flex gap-2 justify-end items-center ${isAdmin ? "text-cyan-400" : "text-slate-400"}`}>
                                    <span>{time}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {msg.text && (
                              <div className={`px-3 py-2 rounded-2xl shadow-sm text-[13px] leading-relaxed ${
                                isAdmin 
                                  ? 'bg-cyan-600 text-white rounded-br-sm' 
                                  : 'bg-slate-700 text-slate-100 rounded-bl-sm border border-slate-600'
                              } ${msg.isDeleted ? 'opacity-60 italic' : ''}`}>
                                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                
                                <div className={`text-[9px] mt-0.5 flex gap-2 justify-end items-center ${isAdmin ? "text-cyan-200" : "text-slate-400"}`}>
                                  {msg.isEdited && <span>(edited)</span>}
                                  <span>{time}</span>
                                </div>
                              </div>
                            )}
                            
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className={`flex gap-1 mt-1 ${isAdmin ? "justify-end" : "justify-start"}`}>
                                {Object.entries(msg.reactions).map(([emoji, users]) => (
                                  <div key={emoji} className="bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1 shadow-sm text-slate-300">
                                    <span>{emoji}</span>
                                    <span>{users.length}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {isAdmin && (
                            <div className="flex items-center justify-center ml-1">
                              <MessageOptionsMenu 
                                message={msg} 
                                isMe={isAdmin} 
                                onEdit={() => { setEditingMessage(msg); setReplyText(msg.text || ""); }}
                                onDelete={() => setShowDeleteConfirm(msg.id)}
                                onPin={() => handlePin(msg.id)}
                                onReact={(emoji) => handleReact(msg.id, emoji)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Image Preview Area */}
                {imagePreview && (
                  <div className="bg-[#1c2636] p-2 border-t border-slate-700 flex items-center justify-between z-10 shadow-lg">
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded shadow-sm border border-slate-600" />
                      <button 
                        onClick={() => { setImagePreview(null); setImageFile(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-400 shadow-md transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 mr-2">Image attached</div>
                  </div>
                )}

                {editingMessage && (
                  <div className="bg-[#1c2636] p-2 border-t border-slate-700 flex justify-between items-center text-xs text-cyan-400">
                    <span>Editing message...</span>
                    <button onClick={() => { setEditingMessage(null); setReplyText(""); }} className="hover:text-white">Cancel</button>
                  </div>
                )}
                
                <div className="p-3 bg-[#1c2636] border-t border-slate-700 shrink-0">
                  <form onSubmit={handleSendReply} className="flex gap-2 items-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isConverting}
                      className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-[#0a0f18] rounded-full transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isConverting ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                    </button>
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onPaste={handlePaste}
                      placeholder={editingMessage ? "Edit your reply..." : "Type a reply..."}
                      className="flex-1 bg-[#0a0f18] text-white border border-slate-600 rounded-full px-3 py-2 focus:outline-none focus:border-cyan-500 text-xs min-w-0"
                    />
                    <button
                      type="submit"
                      disabled={(!replyText.trim() && !imagePreview) || isConverting}
                      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
          
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-2xl w-full max-w-sm">
                <h3 className="text-white font-bold mb-2">Delete Message?</h3>
                <p className="text-slate-400 text-xs mb-4">Are you sure you want to delete this message?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-xs rounded-lg text-slate-300 hover:bg-slate-700">Cancel</button>
                  <button onClick={confirmDelete} className="px-4 py-2 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(8,145,178,0.4)] transition-transform hover:scale-105 active:scale-95"
        >
          <span className="material-symbols-outlined text-[28px]">chat</span>
          {totalUnread > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a0f18]">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Lightbox Modal for Images */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center" 
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 p-2 rounded-full transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={lightboxImage} 
            alt="Fullscreen view" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}
