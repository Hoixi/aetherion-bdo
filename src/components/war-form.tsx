"use client";

import { useState } from "react";

interface WarFormProps {
  onSubmit: () => void;
  initial?: { id: number; title: string; type: string; date: string; notes: string; deadline: string | null; maxParticipants?: number | null };
}

// UTC ISO string'i local datetime-local input formatına çevir
function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WarForm({ onSubmit, initial }: WarFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState(initial?.type ?? "NODE_WAR");
  const [date, setDate] = useState(initial?.date ? toLocalDatetimeValue(initial.date) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ? toLocalDatetimeValue(initial.deadline) : "");
  const [maxParticipants, setMaxParticipants] = useState(initial?.maxParticipants?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const url = initial ? `/api/wars/${initial.id}` : "/api/wars";
    const method = initial ? "PUT" : "POST";

    // datetime-local inputu "2025-05-07T21:00" gibi timezone'suz string verir.
    // new Date() bunu sunucuda UTC olarak parse eder → 3 saat kayma olur.
    // Çözüm: local zamanı ISO string'e çevirip göndermek.
    const toISO = (val: string) => val ? new Date(val).toISOString() : null;

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type,
        date: toISO(date),
        notes,
        deadline: deadline ? toISO(deadline) : null,
        maxParticipants: maxParticipants || null,
      }),
    });

    setSaving(false);
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-bdo-text-muted mb-1">Başlık</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-bdo-text-muted mb-1">Tip</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
          >
            <option value="NODE_WAR">Node War</option>
            <option value="SIEGE">Siege</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-bdo-text-muted mb-1">Tarih</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-bdo-text-muted mb-1">Katılım Deadline (opsiyonel)</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-bdo-text-muted mb-1">Maks Katılımcı (opsiyonel)</label>
        <input
          type="number"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          placeholder="Sınırsız"
          min={1}
          className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-bdo-text-muted mb-1">Notlar</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : initial ? "Güncelle" : "Oluştur"}
      </button>
    </form>
  );
}
