import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import axios from "axios";

const API_BASE = "/api";

export default function AdminChat() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
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
    if (!replyText.trim() || !activeChatId) return;
    try {
      await axios.post(`${API_BASE}/chats/admin/chats/${activeChatId}/messages`, {
        text: replyText,
        senderName: "Admin"
      });
      setReplyText("");
      
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
    <div className="flex h-[calc(100vh-140px)] bg-[#151e2d] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
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
      <div className="flex-1 flex flex-col bg-[#151e2d] min-h-0">
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
                  const isAdmin = msg.senderName === "Admin";
                  return (
                    <div key={msg.id || i} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-end gap-2 max-w-[75%]">
                        {!isAdmin && (
                          <div className="w-6 h-6 rounded-full bg-slate-700 shrink-0 flex items-center justify-center mb-1">
                            <span className="text-xs text-slate-300 font-bold">{(msg.senderName || 'C')[0]}</span>
                          </div>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                          isAdmin 
                            ? 'bg-emerald-600 text-white rounded-br-sm' 
                            : 'bg-slate-700 text-slate-100 rounded-bl-sm border border-slate-600'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 px-8">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-[#1c2636] border-t border-slate-700">
              <form onSubmit={handleSendReply} className="flex gap-3">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 bg-[#0a0f18] text-white border border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-cyan-900/20"
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
    </div>
  );
}
