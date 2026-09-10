import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

import { API_URL, SOCKET_URL } from "../config/api";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch initial notifications & unread count
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/notifications?limit=30&unreadOnly=true`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        const count = data.filter((n) => !n.isRead && !n.is_read).length;
        setUnreadCount(count);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Setup Socket.io connection for real-time alerts
    let socket;
    try {
      socket = io(SOCKET_URL, { autoConnect: true });

      socket.on("connect", () => {
        socket.emit("joinAdmin");
      });

      const handleNewNotification = (payload) => {
        if (!payload) return;

        const notifItem = {
          id: payload.id || `notif_${Date.now()}`,
          type: payload.type || "booking",
          title: payload.title || "New Booking Received",
          message: payload.message || "A new booking was submitted.",
          data: payload.data || {},
          isRead: false,
          is_read: false,
          createdAt: payload.createdAt || payload.created_at || new Date().toISOString(),
        };

        setNotifications((prev) => {
          if (prev.some((n) => n.id === notifItem.id)) return prev;
          return [notifItem, ...prev];
        });

        setUnreadCount((c) => c + 1);

        // Display toast alert
        toast.success(notifItem.message, {
          duration: 6000,
          icon: "🎾",
        });
      };

      socket.on("new_notification", handleNewNotification);
      socket.on("new_booking", (evtData) => {
        if (evtData?.notification) {
          handleNewNotification(evtData.notification);
        } else if (evtData?.booking) {
          const b = evtData.booking;
          handleNewNotification({
            id: `bkg_${Date.now()}`,
            type: "booking",
            title: "New Booking Received",
            message: `New booking received from ${b.playerName || "Customer"} for ${b.courtName || "Court"}`,
            data: b,
            createdAt: new Date().toISOString(),
          });
        }
      });

      return () => {
        socket.off("new_notification", handleNewNotification);
        socket.off("new_booking");
        socket.disconnect();
      };
    } catch (e) {
      console.error("Socket connection error in NotificationBell:", e);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasOpenedRef = useRef(false);

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.filter(n => n.isRead || n.is_read));
      setUnreadCount(0);
      await fetch(`${API_URL}/api/notifications/mark-read`, { method: "PATCH" });
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      hasOpenedRef.current = true;
    } else if (!isOpen && hasOpenedRef.current) {
      if (unreadCount > 0) {
        handleMarkAllRead();
      }
      hasOpenedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, unreadCount]);

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  // Helper for formatting time
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        className="relative p-2 text-slate-400 hover:text-cyan-400 transition-colors focus:outline-none"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        onClick={toggleDropdown}
      >
        <span className="material-symbols-outlined text-[22px] sm:text-[24px]">
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-slate-950 shadow-md animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[min(calc(100vw-2rem),320px)] rounded-xl border border-slate-700/80 bg-[#151e2d] shadow-2xl z-[130] py-3 px-3 text-left">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-0.5">
            {loading && notifications.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading...</p>
            ) : notifications.filter(n => !n.isRead && !n.is_read).length === 0 ? (
              <div className="py-6 text-center">
                <span className="material-symbols-outlined text-slate-600 text-3xl mb-1 block">
                  notifications_off
                </span>
                <p className="text-xs font-medium text-slate-400">
                  No new notifications.
                </p>
              </div>
            ) : (
              notifications.filter(n => !n.isRead && !n.is_read).map((item) => {
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border transition-all bg-slate-800/80 border-cyan-500/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                        <p className="text-xs font-semibold text-white truncate">
                          {item.title || "Notification"}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatTime(item.createdAt || item.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                      {item.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              className="w-full block text-center rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold py-2 hover:bg-cyan-500/25 transition-colors"
              onClick={() => {
                setIsOpen(false);
                navigate("/admin/bookings");
              }}
            >
              Open booking management
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
