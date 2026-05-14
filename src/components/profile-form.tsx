"use client";

import { useState } from "react";
import { BDO_CLASSES, getClassByID } from "@/lib/classes";

interface ProfileFormProps {
  initialData: {
    familyName: string;
    ap: number;
    dp: number;
    class: string;
    spec: string;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [familyName, setFamilyName] = useState(initialData.familyName);
  const [ap, setAp] = useState(initialData.ap);
  const [dp, setDp] = useState(initialData.dp);
  const [bdoClass, setBdoClass] = useState(initialData.class);
  const [spec, setSpec] = useState(initialData.spec || "awakening");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedClass = getClassByID(bdoClass);
  const hasSuccession = selectedClass?.hasSuccession ?? false;

  // If class doesn't have succession and user had succession selected, reset to awakening
  function handleClassChange(newClass: string) {
    setBdoClass(newClass);
    const cls = getClassByID(newClass);
    if (cls && !cls.hasSuccession) {
      setSpec("awakening");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName, ap, dp, class: bdoClass, spec }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-bdo-text-muted mb-1">Aile Adı</label>
        <input
          type="text"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-bdo-text-muted mb-1">AP</label>
          <input
            type="number"
            value={ap}
            onChange={(e) => setAp(Number(e.target.value))}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary font-mono focus:border-bdo-gold focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-bdo-text-muted mb-1">DP</label>
          <input
            type="number"
            value={dp}
            onChange={(e) => setDp(Number(e.target.value))}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary font-mono focus:border-bdo-gold focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-bdo-text-muted mb-1">GS</label>
          <div className="w-full bg-bdo-surface border border-bdo-gold/30 rounded-lg px-3 py-2 text-bdo-gold font-mono text-center">
            {ap + dp}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm text-bdo-text-muted mb-1">Class</label>
        <select
          value={bdoClass}
          onChange={(e) => handleClassChange(e.target.value)}
          className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        >
          <option value="">Seçiniz</option>
          {BDO_CLASSES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {bdoClass && (
        <div>
          <label className="block text-sm text-bdo-text-muted mb-1">Specialization</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSpec("awakening")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                spec === "awakening"
                  ? "bg-bdo-gold text-bdo-bg"
                  : "bg-bdo-surface border border-bdo-border text-bdo-text-muted hover:text-bdo-gold hover:border-bdo-gold/30"
              }`}
            >
              Awakening
            </button>
            <button
              type="button"
              onClick={() => hasSuccession && setSpec("succession")}
              disabled={!hasSuccession}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                spec === "succession"
                  ? "bg-bdo-gold text-bdo-bg"
                  : hasSuccession
                    ? "bg-bdo-surface border border-bdo-border text-bdo-text-muted hover:text-bdo-gold hover:border-bdo-gold/30"
                    : "bg-bdo-surface border border-bdo-border text-bdo-text-muted/30 cursor-not-allowed"
              }`}
            >
              Succession
              {!hasSuccession && <span className="block text-[10px] opacity-60">Mevcut değil</span>}
            </button>
          </div>
        </div>
      )}
      <button
        type="submit"
        disabled={saving}
        className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : saved ? "Kaydedildi ✓" : "Kaydet"}
      </button>
    </form>
  );
}
