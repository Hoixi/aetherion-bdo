"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchNotifications() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: number) {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
    });
    setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(Math.max(0, unreadCount - 1));
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "az önce";
    if (mins < 60) return `${mins}dk`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}sa`;
    return `${Math.floor(hours / 24)}g`;
  }

  const typeIcon: Record<string, string> = {
    NEW_WAR: "⚔️",
    PARTY_ASSIGNED: "🎯",
    DEADLINE_SOON: "⏰",
    WAR_RESULT: "🏆",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative text-bdo-text-muted hover:text-bdo-gold transition-colors p-1"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-bdo-surface border border-bdo-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-bdo-border">
            <span className="text-sm font-semibold text-bdo-text-primary">Bildirimler</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-bdo-gold hover:underline"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-bdo-text-muted">
                Bildirim yok
              </div>
            )}
            {notifications.slice(0, 10).map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-bdo-border/50 hover:bg-bdo-gold/5 transition-colors ${
                  !n.read ? "bg-bdo-gold/[0.03]" : ""
                }`}
              >
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => { markRead(n.id); setOpen(false); }}
                    className="block"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{typeIcon[n.type] || "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${!n.read ? "text-bdo-gold" : "text-bdo-text-primary"}`}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-bdo-text-muted ml-2 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-bdo-text-muted mt-0.5 truncate">{n.message}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-bdo-gold flex-shrink-0 mt-1.5" />}
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{typeIcon[n.type] || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${!n.read ? "text-bdo-gold" : "text-bdo-text-primary"}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-bdo-text-muted ml-2 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-bdo-text-muted mt-0.5 truncate">{n.message}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-bdo-gold flex-shrink-0 mt-1.5" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
