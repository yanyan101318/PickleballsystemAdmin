import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "/api";

export default function AdminChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [isLoadingWidget, setIsLoadingWidget] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();

  // Hide widget completely if we are on the full support page
  const isSupportPage = location.pathname === "/admin/support";

  // Poll chats
  useEffect(() => {
    if (isSupportPage) return;
    const fetchChats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/chats/admin/chats`);
        setChats(res.data || []);
      } catch (err) {
        console.error("Error fetching chats for widget:", err);
      }
    };
    fetchChats();
    const interval = setInterval(fetchChats, 4000);
    return () => clearInterval(interval);
  }, [isSupportPage]);

  // Poll messages for active chat when widget is open
  useEffect(() => {
    if (!isOpen || !activeChatId || isSupportPage) return;
    
    let isCurrent = true;
    
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
        if (isCurrent) {
          setMessages(res.data?.messages || res.data || []);
          setIsLoadingWidget(false);
        }
      } catch (err) {
        console.error("Error fetching messages for widget:", err);
        if (isCurrent) setIsLoadingWidget(false);
      }
    };
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    
    return () => {
      isCurrent = false;
      clearInterval(interval);
    };
  }, [isOpen, activeChatId, isSupportPage]);

  // Mark as read when opening a chat
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

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeChatId) return;
    try {
      await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`, {
        text: replyText,
        senderName: "Admin"
      });
      setReplyText("");
      const res = await axios.get(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`);
      setMessages(res.data?.messages || res.data || []);
    } catch (err) {
      console.error("Error sending reply from widget:", err);
    }
  };

  const handleExpand = () => {
    setIsOpen(false);
    navigate("/admin/support");
  };

  const handleChatSelect = (id) => {
    if (activeChatId === id) return;
    setMessages([]);
    setIsLoadingWidget(true);
    setActiveChatId(id);
  };

  if (isSupportPage) return null;

  const totalUnread = chats.filter(c => c.unreadByAdmin).length;
  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      
      {/* Widget Window */}
      {isOpen && (
        <div className="mb-4 w-[360px] h-[520px] bg-[#151e2d] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all transform origin-bottom-right">
          
          {/* Header */}
          <div className="h-14 bg-[#1c2636] border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
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
              <button 
                onClick={handleExpand} 
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Open in full page"
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden relative bg-[#0a0f18]">
            {!activeChatId ? (
              // Screen 1: Chat List
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
                          <h4 className="font-semibold text-slate-200 text-sm truncate pr-2">
                            {chat.userName || "Unknown"}
                          </h4>
                          {chat.unreadByAdmin && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{chat.lastMessage || "No messages"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              // Screen 2: Active Chat Messages
              <div className="flex flex-col h-full bg-[#0a0f18]">
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
                      const isAdmin = msg.senderName === "Admin";
                      return (
                        <div key={msg.id || i} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                          <div className={`px-3 py-2 rounded-2xl shadow-sm text-[13px] leading-relaxed max-w-[85%] ${
                            isAdmin 
                              ? 'bg-cyan-600 text-white rounded-br-sm' 
                              : 'bg-slate-700 text-slate-100 rounded-bl-sm border border-slate-600'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {/* Input Area */}
                <div className="p-3 bg-[#1c2636] border-t border-slate-700 shrink-0">
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a reply..."
                      className="flex-1 bg-[#0a0f18] text-white border border-slate-600 rounded-full px-3 py-2 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(8,145,178,0.4)] transition-transform hover:scale-105 active:scale-95"
        >
          <span className="material-symbols-outlined text-[28px]">
            chat
          </span>
          {totalUnread > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a0f18]">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}

    </div>
  );
}
