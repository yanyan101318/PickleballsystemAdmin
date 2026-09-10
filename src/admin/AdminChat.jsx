import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import MessageOptionsMenu from "../components/chat/MessageOptionsMenu";
import { Pin, Paperclip, X, Loader2 } from "lucide-react";

const API_BASE = "/api";

export default function AdminChat() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [editingMessage, setEditingMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileInputRef = useRef(null);
  
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const prevScrollHeightRef = useRef(0);
  const activeChatIdRef = useRef(activeChatId);

  const messagesContainerRef = useRef(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Poll all chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/chats/admin/chats`);
        setChats(res.data || []);
      } catch (err) {
        console.error("Error fetching chats:", err);
      }
    };
    fetchChats();
    const interval = setInterval(fetchChats, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async (currentCursor, isPolling = false) => {
    const fetchId = activeChatId;
    if (!fetchId) return;
    if (isLoading && !isPolling) return;
    if (!currentCursor && !isPolling) setIsLoading(true);

    try {
      const url = currentCursor 
        ? `${API_BASE}/chats/admin/chats/${fetchId}/messages?cursor=${encodeURIComponent(currentCursor)}`
        : `${API_BASE}/chats/admin/chats/${fetchId}/messages`;

      const res = await axios.get(url);
      
      // Prevent race conditions: if we switched chats while fetching, ignore this data
      if (activeChatIdRef.current !== fetchId) return;

      const data = res.data; // data contains { messages, nextCursor }

      if (data && data.messages) {
        setMessages(prev => {
          if (isPolling) {
            // During polling, if we have old messages, we probably just want to merge or refresh the latest
            // A simple approach for this chat: polling just refreshes the bottom without cursor
            // To prevent overwriting history, we might just poll the whole thing or disable polling for history.
            // Let's assume if it's polling, we just use it if there's no cursor, or we just append new.
            // Actually, for a robust system, we should poll for NEW messages, but for now let's just use the fetched.
            // If they are scrolling up, polling might mess up the list, so we'll only poll if not scrolled up.
            return currentCursor ? [...data.messages, ...prev] : data.messages;
          }
          return currentCursor ? [...data.messages, ...prev] : data.messages;
        });
        
        if (!isPolling) {
          setCursor(data.nextCursor);
          setHasMore(!!data.nextCursor);
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      if (!currentCursor && !isPolling) setIsLoading(false);
    }
  };

  // Initial fetch and polling for active chat
  useEffect(() => {
    if (!activeChatId) return;
    
    // Reset state for new chat
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    prevScrollHeightRef.current = 0;
    
    fetchMessages(null, false);
    
    const interval = setInterval(() => {
      // Basic polling: only fetch latest without cursor if they are at the bottom
      const container = messagesContainerRef.current;
      if (container && container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
         fetchMessages(null, true);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [activeChatId]);

  // Mark as read when active chat changes
  useEffect(() => {
    if (!activeChatId) return;
    const markAsRead = async () => {
      try {
        await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/mark-read`);
        // Update local state to remove red dot immediately
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, unreadByAdmin: false } : c));
      } catch (err) {
        console.error("Error marking chat as read:", err);
      }
    };
    markAsRead();
  }, [activeChatId]);

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

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 5 && hasMore && !isLoading) {
      prevScrollHeightRef.current = container.scrollHeight;
      fetchMessages(cursor, false);
    }
  };

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeightRef.current;
      container.scrollTop = container.scrollTop + heightDifference;
      prevScrollHeightRef.current = 0;
    } else if (messages.length > 0 && !cursor && !isLoading) { 
      // Scroll to bottom on initial load
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, cursor, isLoading]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!activeChatId || (!replyText.trim() && !imagePreview && !editingMessage)) return;
    try {
      if (editingMessage) {
        await axios.put(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${editingMessage.id}`, { text: replyText.trim() });
        setEditingMessage(null);
        setReplyText("");
      } else {
        await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`, {
          text: replyText.trim(),
          senderName: "Admin",
          image: imagePreview
        });
        setReplyText("");
        setImagePreview(null);
        setImageFile(null);
      }
      
      // Fetch messages immediately to show response
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      if (res.data && res.data.messages) {
        // Assume we just set it since it's the latest
        setMessages(res.data.messages);
      }
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error("Error sending reply:", err);
      toast.error("Failed to send reply");
    }
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm || !activeChatId) return;
    try {
      await axios.delete(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${showDeleteConfirm}`);
      setShowDeleteConfirm(null);
      toast.success("Message deleted");
      // refresh messages
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      if (res.data && res.data.messages) setMessages(res.data.messages);
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handlePin = async (msgId) => {
    try {
      await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${msgId}/pin`);
      // refresh messages
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      if (res.data && res.data.messages) setMessages(res.data.messages);
    } catch (err) {
      toast.error("Failed to pin message");
    }
  };

  const handleReact = async (msgId, emoji) => {
    try {
      await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages/${msgId}/react`, { emoji });
      // refresh messages
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      if (res.data && res.data.messages) setMessages(res.data.messages);
    } catch (err) {
      toast.error("Failed to react");
    }
  };

  const handleChatSelect = (id) => {
    if (activeChatId === id) return;
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    setIsLoading(true);
    setActiveChatId(id);
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  const filteredChats = chats.filter(chat => {
    const term = searchTerm.toLowerCase();
    return (
      (chat.userName && chat.userName.toLowerCase().includes(term)) ||
      (chat.email && chat.email.toLowerCase().includes(term)) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[#151e2d] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* LEFT: Chat List */}
      <div className="w-1/3 min-w-[280px] max-w-[360px] border-r border-slate-700 bg-[#0a0f18] flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-800 bg-[#151e2d]">
          <h2 className="text-lg font-bold text-white mb-3">Customer Support</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0f18] text-white border border-slate-700 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm font-medium">No active chats</div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => handleChatSelect(chat.id)}
                className={`w-full text-left p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors relative flex items-start gap-3 ${
                  activeChatId === chat.id ? 'bg-slate-800' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-bold uppercase text-lg">
                    {(chat.userName || 'U')[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-slate-200 truncate pr-2">
                      {chat.userName || 'Unknown User'}
                    </h3>
                    {chat.unreadByAdmin && (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate w-full">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Active Chat View */}
      <div 
        className="flex-1 flex flex-col bg-[#151e2d] min-h-0 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-cyan-900/20 backdrop-blur-sm border-4 border-dashed border-cyan-500 flex items-center justify-center">
            <div className="bg-slate-800 text-cyan-400 font-bold px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-4xl">cloud_upload</span>
              Drop image here to attach
            </div>
          </div>
        )}
        {activeChatId ? (
          <>
            <div className="p-4 border-b border-slate-700 bg-[#1c2636] flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                  <span className="text-cyan-400 font-bold uppercase text-lg">
                    {(activeChat?.userName || 'U')[0]}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {activeChat?.userName || 'Customer'}
                  </h2>
                  <p className="text-xs text-slate-400">Connected</p>
                </div>
              </div>
            </div>
            
            <div 
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-[#151e2d] to-[#0a0f18]"
                ref={messagesContainerRef}
                onScroll={handleScroll}
            >

              {isLoading && messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="w-10 h-10 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium">Loading chat...</p>
                </div>
              ) : messages.length === 0 && !isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">forum</span>
                  <p className="text-sm font-medium">No messages yet. Send a greeting!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isAdmin = msg.senderName === "Admin" || msg.senderId === "admin";
                  const isDel = msg.isDeleted || msg.is_deleted;
                  const prevMsg = i > 0 ? messages[i-1] : null;
                  const isDuplicateDeletedGroup = isDel && msg.group_id && prevMsg?.group_id === msg.group_id && (prevMsg?.isDeleted || prevMsg?.is_deleted);
                  if (isDuplicateDeletedGroup) return null;
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
                                    message={{...msg, isPinned: msg.is_pinned, isEdited: msg.is_edited, isDeleted: msg.is_deleted}}
                                    isMe={isAdmin} 
                                    onDelete={() => setShowDeleteConfirm(msg.id)}
                                    onPin={() => handlePin(msg.id)}
                                    onReact={(emoji) => handleReact(msg.id, emoji)}
                                  />
                                </div>
                              )}

                      <div className="flex flex-col max-w-[75%] relative gap-1">
                        {msg.is_pinned && (
                           <div className="flex items-center gap-1 text-[10px] text-cyan-400 mb-1 ml-1">
                             <Pin size={10} /> Pinned
                           </div>
                        )}
                        {msg.image && (
                          <div className={`rounded-2xl shadow-sm overflow-hidden ${msg.is_deleted ? 'opacity-60' : ''}`}>
                            <img 
                              src={msg.image} 
                              alt="Attachment" 
                              className="max-w-full max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxImage(msg.image)}
                            />
                            {!msg.text && (
                              <div className={`text-[10px] mt-1 flex gap-2 justify-end items-center ${isAdmin ? "text-emerald-400" : "text-slate-400"}`}>
                                <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {msg.text && (
                          <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                            isAdmin 
                              ? 'bg-emerald-600 text-white rounded-br-sm' 
                              : 'bg-slate-700 text-slate-100 rounded-bl-sm border border-slate-600'
                          } ${msg.is_deleted ? 'opacity-60 italic' : ''}`}>
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            <div className={`text-[10px] mt-1 flex gap-2 justify-end items-center ${isAdmin ? "text-emerald-200" : "text-slate-400"}`}>
                              {msg.is_edited && <span>(edited)</span>}
                              <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
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
                            message={{...msg, isPinned: msg.is_pinned, isEdited: msg.is_edited, isDeleted: msg.is_deleted}} 
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
            </div>

            {/* Image Preview Area */}
            {imagePreview && (
              <div className="bg-[#1c2636] p-4 border-t border-slate-700 flex items-center justify-between z-10 shadow-lg">
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded shadow-sm border border-slate-600" />
                  <button 
                    onClick={() => { setImagePreview(null); setImageFile(null); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-400 shadow-md transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="text-sm text-slate-400 mr-4">Image attached</div>
              </div>
            )}

            <div className="p-4 bg-[#1c2636] border-t border-slate-700 relative">
              <form onSubmit={handleSendReply} className="flex gap-3 items-center">
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
                  className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-[#0a0f18] rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0 border border-slate-700 hover:border-cyan-900"
                >
                  {isConverting ? <Loader2 size={24} className="animate-spin" /> : <Paperclip size={24} />}
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={editingMessage ? "Edit your reply..." : "Type your reply..."}
                  className="flex-1 bg-[#0a0f18] text-white border border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm min-w-0"
                />
                <button
                  type="submit"
                  disabled={(!replyText.trim() && !imagePreview) || isConverting}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-cyan-900/20 shrink-0"
                >
                  <span>Send</span>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">chat_bubble</span>
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm opacity-70 mt-1">Choose a chat from the sidebar to view messages.</p>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-sm">
            <h3 className="text-white font-bold mb-2 text-lg">Delete Message?</h3>
            <p className="text-slate-400 text-sm mb-6">Are you sure you want to delete this message?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-5 py-2.5 text-sm rounded-lg text-slate-300 hover:bg-slate-700 font-medium">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium shadow-lg shadow-red-500/20">Delete</button>
            </div>
          </div>
        </div>
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
