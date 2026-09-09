import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, Edit2, Trash2, Copy, Link, Pin, Smile } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MessageOptionsMenu({ 
  message, 
  isMe, 
  onEdit, 
  onDelete, 
  onPin, 
  onReact
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const menuRef = useRef(null);
  
  const emojis = ['👍', '❤️', '😂', '😮', '😢'];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowEmojis(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    toast.success('Message copied');
    setIsOpen(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/admin/support?msg=${message.id}`);
    toast.success('Link copied');
    setIsOpen(false);
  };

  const handleAction = (action, e) => {
    e.stopPropagation();
    action();
    setIsOpen(false);
  };

  // For Admin, they can do almost everything (delete/pin any message).
  // They don't report messages, they just delete them.
  
  return (
    <div className="relative inline-block opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        aria-label="Message options"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div 
          className={`absolute z-[100] w-48 py-1 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl ${
            isMe ? 'right-0' : 'left-0'
          }`}
        >
          {showEmojis ? (
            <div className="flex justify-between p-2">
              {emojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={(e) => handleAction(() => onReact(emoji), e)}
                  className="p-1 hover:bg-slate-700 rounded text-lg transition-transform hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col text-sm">
              <button onClick={(e) => { e.stopPropagation(); setShowEmojis(true); }} className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left">
                <Smile size={14} /> React
              </button>
              
              {isMe && (
                <button onClick={(e) => handleAction(onEdit, e)} className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left">
                  <Edit2 size={14} /> Edit
                </button>
              )}
              
              <button onClick={(e) => handleAction(handleCopy, e)} className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left">
                <Copy size={14} /> Copy
              </button>
              
              <button onClick={(e) => handleAction(handleCopyLink, e)} className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left">
                <Link size={14} /> Copy Link
              </button>
              
              <button onClick={(e) => handleAction(onPin, e)} className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left">
                <Pin size={14} /> {message.isPinned ? 'Unpin' : 'Pin'}
              </button>
              
              <button onClick={(e) => handleAction(onDelete, e)} className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full text-left border-t border-slate-700/50">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
