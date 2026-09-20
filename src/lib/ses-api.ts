"use client";

import type { SesApi } from "@/lib/ses-web";

/**
 * Tarayıcıdan /api/app/* uçları — aynı köken, çerezle. Uygulamanın
 * api.ts'indeki adların birebir karşılığı; ses-web.ts SesApi ile çalışır.
 */

export interface Savas {
  id: number; title: string; type: string; tier: string; date: string; deadline: string | null;
  isAllyWar: boolean; attending: number | null; myStatus: "ATTENDING" | "DECLINED" | null; myClass: string | null;
  parties: Array<{ id: number; name: string; role: string; members: Array<{ id: number; familyName: string; class: string }> }>;
  myParty: { id: number; name: string; role: string } | null;
}
export interface OdaListesi {
  rooms: Array<{ id: number; name: string; slug: string; category: string; adminOnly: boolean; canJoin: boolean; members: string[] }>;
  warRooms: Array<{ room: string; label: string; members: string[] }>;
  canManage: boolean;
}
export interface Mesaj { id: number; text: string; createdAt: string; user: { id: number; familyName: string; class: string } }
export interface OnlineUye { id: number; familyName: string; class: string; guild: string | null }

async function call<T>(yol: string, init?: RequestInit): Promise<T> {
  const r = await fetch(yol, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!r.ok) {
    const b = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(b.error || `HTTP ${r.status}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = (body: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(body) });

export const sesApi: SesApi & {
  wars: () => Promise<Savas[]>;
  voiceRooms: () => Promise<OdaListesi>;
  voiceRoomCreate: (name: string, adminOnly: boolean, category: string) => Promise<{ id: number }>;
  voiceRoomDelete: (id: number) => Promise<void>;
  chat: (after?: number) => Promise<Mesaj[]>;
  chatSend: (text: string) => Promise<Mesaj>;
  online: () => Promise<OnlineUye[]>;
  nabiz: () => Promise<void>;
} = {
  voiceToken: (warId, room, partyId) => call("/api/app/voice/token", post({ warId, room, partyId })),
  voiceRoomToken: (id) => call("/api/app/voice/rooms", post({ id }, "PUT")),
  voiceAnons: () => call("/api/app/voice/anons", post({})),
  wars: () => call("/api/app/wars"),
  voiceRooms: () => call("/api/app/voice/rooms"),
  voiceRoomCreate: (name, adminOnly, category) => call("/api/app/voice/rooms", post({ name, adminOnly, category })),
  voiceRoomDelete: (id) => call(`/api/app/voice/rooms?id=${id}`, { method: "DELETE" }),
  chat: (after) => call(`/api/app/chat${after ? `?after=${after}` : ""}`),
  chatSend: (text) => call("/api/app/chat", post({ text })),
  online: () => call("/api/app/online"),
  nabiz: () => call("/api/app/online", post({})),
};
