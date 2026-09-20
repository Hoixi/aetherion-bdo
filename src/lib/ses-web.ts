"use client";

import { Room, RoomEvent, Track, LocalAudioTrack, createAudioAnalyser, type RemoteAudioTrack, type RemoteParticipant, type Participant } from "livekit-client";
import { useEffect, useState } from "react";
import { RnnoiseWorkletNode, GtcrnWorkletNode, loadRnnoise, loadGtcrn } from "@sapphi-red/web-noise-suppressor";

// Worklet ve wasm dosyaları public/ses altında (paketten kopya; Next'te ?url yok)
const rnnoiseWorkletUrl = "/ses/rnnoiseWorklet.js";
const rnnoiseWasmUrl = "/ses/rnnoise.wasm";
const rnnoiseSimdWasmUrl = "/ses/rnnoise_simd.wasm";
const gtcrnWorkletUrl = "/ses/gtcrnWorklet.js";
const gtcrnWasmUrl = "/ses/gtcrn.wasm";

/** Sayfanın kullandığı üç uç — tarayıcı sürümü çerezle, uygulama Bearer ile */
export interface SesApi {
  voiceToken: (warId: number, room: "parti" | "genel", partyId?: number) => Promise<{ url: string; token: string; room: string; label: string; partyId?: number | null }>;
  voiceRoomToken: (id: number) => Promise<{ url: string; token: string; room: string; label: string }>;
  voiceAnons: () => Promise<{ url: string; token: string; canPublish: boolean }>;
}

/**
 * Sesli sohbet — LiveKit (kendi sunucumuz), yalnızca ses.
 *
 * Mikrofon yolu: getUserMedia (eko iptali; tarayıcı NS yalnızca "tarayici"
 * modunda) → GainNode (seviye) → gürültü engelleyici (RNNoise ya da GTCRN,
 * AudioWorklet'te WebAssembly) → ölçer → kapı (eşik altı sessizlik) →
 * LiveKit'e yayın. RNNoise hafif ve klavye/fan için yeterli; GTCRN daha
 * güçlü sinir ağı, biraz daha CPU. Ölçer kapı öncesinde ama engelleyici
 * sonrasında: eşik, temizlenmiş sese göre ayarlanır.
 *
 * Bas-konuş (PTT) tarayıcıda: sayfa odaktayken klavye/fare tuşu. (Masaüstü
 * uygulamasında Rust tarafı oyun odaktayken de görür; burada o yok.)
 *
 * Anons (tüm odalara konuş): herkes asıl odasının yanında bir de "anons"
 * odasına bağlanır (yalnızca dinler). Yönetici, işlenmiş mikrofon akışının
 * bir kopyasını anons odasına da yayınlar; tuşla (basılıyken) ya da otomatik
 * (mikrofonu açıkken hep). Aynı odadakiler yayını iki kez duymasın diye
 * anons odasındaki kişi benim odamda da varsa anons kopyası kısılır.
 */

export interface SesKatilimci { id: string; ad: string; konusuyor: boolean; sessiz: boolean; ben: boolean; seviye: number; susturuldu: boolean }
export interface SesDurum {
  bagli: boolean; baglaniyor: boolean; oda: string | null; etiket: string | null; savasId: number | null; partyId: number | null;
  mikrofon: boolean; ptt: boolean; katilimcilar: SesKatilimci[]; hata: string | null;
  /** kulaklık kapalı: kimseyi duymam (mikrofon da kapanır, Discord gibi) */
  sagir: boolean;
  /** anlık mikrofon seviyesi, dBFS (−100..0) — kapı öncesi */
  olcer: number;
  /** kapı şu an açık mı (eşik üstü) */
  kapiAcik: boolean;
  /** şu an tüm odalara konuşuyorum */
  anonsAcik: boolean;
  /** anons odasından şu an konuşanlar (benim odamda olmayanlar) */
  anonsKonusanlar: string[];
}
export type AnonsMod = "kapali" | "tus" | "otomatik";
export type GurultuMod = "kapali" | "tarayici" | "rnnoise" | "gtcrn";
export interface SesAyar { gurultuMod: GurultuMod; kazanc: number; esikDb: number; mikrofon: string | null; hoparlor: string | null; cikis: number }

/** getUserMedia hatasını Türkçe, ne yapılacağını söyleyen bir metne çevir */
export function mikrofonHatasi(e: unknown): string {
  const err = e as { name?: string; message?: string };
  const m = err?.message ?? String(e);
  if (err?.name === "NotAllowedError" || /permission denied|not allowed/i.test(m)) {
    if (/system/i.test(m)) return "Windows mikrofon erişimini kapatmış. Ayarlar → Gizlilik ve güvenlik → Mikrofon: 'Mikrofon erişimi' ve 'Masaüstü uygulamalarının mikrofonunuza erişmesine izin ver' açık olmalı.";
    return "Mikrofon izni reddedildi. Ses ayarlarında (⚙) 'Mikrofon izni' bölümünden tekrar dene; olmazsa Windows mikrofon ayarlarını kontrol et.";
  }
  if (err?.name === "NotFoundError" || /not found|requested device/i.test(m)) return "Mikrofon bulunamadı. Takılı mı, Windows'ta görünüyor mu?";
  if (err?.name === "NotReadableError" || /could not start|in use/i.test(m)) return "Mikrofon başka bir uygulama tarafından kullanılıyor ya da açılamadı.";
  if (err?.name === "OverconstrainedError") return "Seçili mikrofon artık yok; ayarlardan başka bir mikrofon seç.";
  return `Mikrofon açılamadı: ${m}`;
}

type Dinleyici = (d: SesDurum) => void;

/** Worklet düğümü tek kanal alsın ve tek kanal versin; hedef stereoya kendisi yayar */
function monoYap<T extends AudioWorkletNode>(n: T): T {
  n.channelCount = 1; n.channelCountMode = "explicit"; n.channelInterpretation = "speakers";
  return n;
}

class SesYoneticisi {
  private room: Room | null = null;
  private dinleyiciler = new Set<Dinleyici>();
  private pttKod = "";
  private pttBasili = false;
  private tusDinleyiciKuruldu = false;
  // Anons
  private anons: Room | null = null;
  private anonsYayin: LocalAudioTrack | null = null;
  private anonsMod: AnonsMod = "kapali";
  private anonsKod = "";
  private anonsBasili = false;
  /** anons tuşu mikrofonu açtıysa bırakınca kapatılır */
  private anonsMikActi = false;
  private ayar: SesAyar = { gurultuMod: "rnnoise", kazanc: 1, esikDb: -100, mikrofon: null, hoparlor: null, cikis: 1 };
  private wasm: { rnnoise?: ArrayBuffer; gtcrn?: ArrayBuffer; worklets: Set<string> } = { worklets: new Set() };
  private denoiser: AudioWorkletNode | null = null;
  private susturulan = new Set<string>();
  private sagirOncesiMik = false;
  // Web Audio zinciri
  private ctx: AudioContext | null = null;
  private ham: MediaStream | null = null;
  private kazanc: GainNode | null = null;
  private olcerZamanlayici: number | null = null;
  private yayin: LocalAudioTrack | null = null;
  private hacimler = new Map<string, number>();
  /** Kapı açık kalsın diye eşik üstü son an (ms) */
  private sonSesli = 0;
  // "Konuşuyor" göstergesi: sunucunun aktif konuşmacı olayı ~1 sn gecikiyor;
  // her uzak parçaya yerel bir analizör bağlayıp 60 ms'de bir kendimiz bakıyoruz.
  private analizler = new Map<string, { hacim: () => number; kapat: () => Promise<void>; son: number }>();
  private konusanlar = new Set<string>();
  private konusmaZamanlayici: number | null = null;
  private benKonusuyor = false;
  private benSonSes = 0;

  durum: SesDurum = { bagli: false, baglaniyor: false, oda: null, etiket: null, savasId: null, partyId: null, mikrofon: false, ptt: false,
                      katilimcilar: [], hata: null, sagir: false, olcer: -100, kapiAcik: false, anonsAcik: false, anonsKonusanlar: [] };

  abone(f: Dinleyici) { this.dinleyiciler.add(f); f(this.durum); return () => { this.dinleyiciler.delete(f); }; }
  private yay(p: Partial<SesDurum>) { this.durum = { ...this.durum, ...p }; this.dinleyiciler.forEach((f) => f(this.durum)); }

  private katilimcilariTopla() {
    const r = this.room; if (!r) return [];
    const liste: SesKatilimci[] = [];
    const ekle = (p: Participant, ben: boolean) => liste.push({
      id: p.identity, ad: p.name || p.identity, ben,
      konusuyor: ben ? this.benKonusuyor : this.analizler.has(p.identity) ? this.konusanlar.has(p.identity) : p.isSpeaking,
      sessiz: ben ? !this.durum.mikrofon : !p.isMicrophoneEnabled,
      seviye: ben ? 100 : Math.round((this.hacimler.get(p.identity) ?? 1) * 100),
      susturuldu: !ben && this.susturulan.has(p.identity),
    });
    ekle(r.localParticipant, true);
    r.remoteParticipants.forEach((p: RemoteParticipant) => ekle(p, false));
    return liste.sort((a, b) => Number(b.ben) - Number(a.ben) || a.ad.localeCompare(b.ad, "tr"));
  }
  private tazele() { this.yay({ katilimcilar: this.katilimcilariTopla() }); }

  /** Ayarları uygula; bağlıyken de canlı değişir */
  ayarla(a: Partial<SesAyar>) {
    const eskiMik = this.ayar.mikrofon, eskiGurultu = this.ayar.gurultuMod, eskiHop = this.ayar.hoparlor;
    this.ayar = { ...this.ayar, ...a };
    if (this.kazanc) this.kazanc.gain.value = this.ayar.kazanc;
    if (a.cikis !== undefined) { this.room?.remoteParticipants.forEach((p) => this.uygulaHacim(p.identity)); this.anonsHacimUygula(); }
    if (this.room && eskiHop !== this.ayar.hoparlor) void this.room.switchActiveDevice("audiooutput", this.ayar.hoparlor ?? "default").catch(() => {});
    // Mikrofon ya da gürültü engelleme değiştiyse akışı yeniden aç
    if (this.ham && (eskiMik !== this.ayar.mikrofon || eskiGurultu !== this.ayar.gurultuMod)) void this.mikrofonuKur(!!this.room);
  }

  /** Mikrofon zinciri: ölçer bağlantı öncesi de çalışır (ayar sayfasında kalibrasyon) */
  async olcerBaslat() {
    if (this.ham) return;
    try { await this.mikrofonuKur(false); } catch (e) { this.yay({ hata: mikrofonHatasi(e) }); throw e; }
  }

  /** Mikrofon izni durumu: "granted" | "denied" | "prompt" | null (sorgulanamadı) */
  async izinDurumu(): Promise<PermissionState | null> {
    try { return (await navigator.permissions.query({ name: "microphone" as PermissionName })).state; } catch { return null; }
  }
  async olcerDurdur() { if (!this.room) this.mikrofonuKapat(); }

  private async mikrofonuKur(yayinla: boolean) {
    this.mikrofonuKapat();
    const ctx = this.ctx ?? new AudioContext({ sampleRate: 48000 });
    this.ctx = ctx;
    const ham = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.ayar.mikrofon ? { exact: this.ayar.mikrofon } : undefined,
        echoCancellation: true, noiseSuppression: this.ayar.gurultuMod === "tarayici", autoGainControl: false,
        channelCount: 1, sampleRate: 48000,
      },
    });
    this.ham = ham;
    const kaynak = ctx.createMediaStreamSource(ham);
    // Bazı kulaklıklar channelCount:1 istense de stereo veriyor; gürültü
    // engelleyici yalnızca 0. kanalı işleyince ses sadece SOL kulaktan
    // geliyordu. Önce açıkça monoya indir (L+R karışımı), zincir mono gider.
    const mono = ctx.createGain(); mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
    const kazanc = ctx.createGain(); kazanc.gain.value = this.ayar.kazanc;
    kazanc.channelCount = 1; kazanc.channelCountMode = "explicit";
    const analiz = ctx.createAnalyser(); analiz.fftSize = 1024; analiz.smoothingTimeConstant = 0.4;
    const kapi = ctx.createGain(); kapi.gain.value = 1;
    const hedef = ctx.createMediaStreamDestination();
    const temiz = await this.gurultuDugumu(ctx);
    kaynak.connect(mono); mono.connect(kazanc);
    const cikis: AudioNode = temiz ? (kazanc.connect(temiz), temiz) : kazanc;
    cikis.connect(analiz); cikis.connect(kapi); kapi.connect(hedef);
    this.kazanc = kazanc; this.denoiser = temiz;

    // Ölçer + kapı: 50 ms'de bir RMS → dBFS; eşik altı 250 ms sonra kapanır
    const veri = new Float32Array(analiz.fftSize);
    this.olcerZamanlayici = window.setInterval(() => {
      analiz.getFloatTimeDomainData(veri);
      let s = 0; for (let i = 0; i < veri.length; i++) s += veri[i] * veri[i];
      const rms = Math.sqrt(s / veri.length);
      const db = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
      const simdi = performance.now();
      if (db >= this.ayar.esikDb) this.sonSesli = simdi;
      const acik = this.ayar.esikDb <= -99 || simdi - this.sonSesli < 250;
      const hedefKazanc = acik ? 1 : 0;
      if (Math.abs(kapi.gain.value - hedefKazanc) > 0.01) kapi.gain.setTargetAtTime(hedefKazanc, ctx.currentTime, 0.02);
      if (Math.abs(db - this.durum.olcer) > 0.5 || acik !== this.durum.kapiAcik) this.yay({ olcer: Math.round(db), kapiAcik: acik });
      // Kendi "konuşuyor" ışığım: −50 dB üstü, 200 ms tutma; mikrofon kapalıysa yanmaz
      if (db > -50) this.benSonSes = simdi;
      const benOn = this.durum.mikrofon && acik && simdi - this.benSonSes < 200;
      if (benOn !== this.benKonusuyor) { this.benKonusuyor = benOn; this.tazele(); }
    }, 50);

    if (yayinla && this.room) {
      const track = new LocalAudioTrack(hedef.stream.getAudioTracks()[0], undefined, false);
      await this.room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, dtx: true, red: true, audioPreset: { maxBitrate: 32_000 } });
      this.yayin = track;
      if (!this.durum.mikrofon) await track.mute();
      // Yönetici + anons açık: aynı işlenmiş akışın kopyası anons odasına, kapalı başlar
      if (this.anons && this.anonsMod !== "kapali" && this.anons.localParticipant.permissions?.canPublish) {
        try {
          const kopya = new LocalAudioTrack(hedef.stream.getAudioTracks()[0].clone(), undefined, false);
          await this.anons.localParticipant.publishTrack(kopya, { source: Track.Source.Microphone, dtx: true, red: true, audioPreset: { maxBitrate: 32_000 } });
          await kopya.mute();
          this.anonsYayin = kopya;
        } catch (e) { this.yay({ hata: `Anons yayını açılamadı: ${(e as Error).message}` }); }
      }
      await this.anonsGuncelle();
    }
  }

  /** Seçili moda göre gürültü engelleyici düğümü (wasm bir kez yüklenir, worklet bir kez eklenir) */
  private async gurultuDugumu(ctx: AudioContext): Promise<AudioWorkletNode | null> {
    const mod = this.ayar.gurultuMod;
    if (mod !== "rnnoise" && mod !== "gtcrn") return null;
    try {
      if (mod === "rnnoise") {
        this.wasm.rnnoise ??= await loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl });
        if (!this.wasm.worklets.has("rnnoise")) { await ctx.audioWorklet.addModule(rnnoiseWorkletUrl); this.wasm.worklets.add("rnnoise"); }
        return monoYap(new RnnoiseWorkletNode(ctx, { wasmBinary: this.wasm.rnnoise, maxChannels: 1 }));
      }
      this.wasm.gtcrn ??= await loadGtcrn({ url: gtcrnWasmUrl });
      if (!this.wasm.worklets.has("gtcrn")) { await ctx.audioWorklet.addModule(gtcrnWorkletUrl); this.wasm.worklets.add("gtcrn"); }
      return monoYap(new GtcrnWorkletNode(ctx, { wasmBinary: this.wasm.gtcrn, maxChannels: 1 }));
    } catch (e) {
      this.yay({ hata: `Gürültü engelleyici yüklenemedi (${mod}): ${(e as Error).message}` });
      return null;
    }
  }

  private mikrofonuKapat() {
    if (this.olcerZamanlayici) { clearInterval(this.olcerZamanlayici); this.olcerZamanlayici = null; }
    this.ham?.getTracks().forEach((t) => t.stop()); this.ham = null;
    this.kazanc = null;
    if (this.denoiser) { try { this.denoiser.disconnect(); (this.denoiser as unknown as { destroy?: () => void }).destroy?.(); } catch { /* yok */ } this.denoiser = null; }
    if (this.yayin) { const y = this.yayin; this.yayin = null; if (this.room) void this.room.localParticipant.unpublishTrack(y, true); }
    if (this.anonsYayin) { const y = this.anonsYayin; this.anonsYayin = null; if (this.anons) void this.anons.localParticipant.unpublishTrack(y, true); }
    this.yay({ olcer: -100, kapiAcik: false, anonsAcik: false });
  }

  async baglan(api: SesApi, warId: number, tur: "parti" | "genel", partyId?: number) {
    return this.odayaGir(api, () => api.voiceToken(warId, tur, partyId), warId);
  }
  /** Kalıcı oda */
  async odayaBaglan(api: SesApi, odaId: number) {
    return this.odayaGir(api, () => api.voiceRoomToken(odaId), null);
  }

  private async odayaGir(api: SesApi, anahtar: () => Promise<{ url: string; token: string; room: string; label: string; partyId?: number | null }>, warId: number | null) {
    if (this.room) await this.ayril();
    this.yay({ baglaniyor: true, hata: null });
    try {
      const t = await anahtar();
      // webAudioMix: sesler GainNode'dan geçer → %100 üstü hacim mümkün (HTMLAudioElement.volume
      // 1'i geçemez, geçince IndexSizeError fırlatıp ayarı hiç uygulamıyordu)
      const room = new Room({ adaptiveStream: false, dynacast: false, webAudioMix: true });
      room.on(RoomEvent.ParticipantConnected, () => { this.tazele(); this.anonsHacimUygula(); })
          .on(RoomEvent.ParticipantDisconnected, () => { this.tazele(); this.anonsHacimUygula(); })
          .on(RoomEvent.ActiveSpeakersChanged, () => this.tazele())
          .on(RoomEvent.TrackMuted, () => this.tazele())
          .on(RoomEvent.TrackUnmuted, () => this.tazele())
          .on(RoomEvent.TrackSubscribed, (track, _pub, p) => { if (track.kind === Track.Kind.Audio) { track.attach(); this.uygulaHacim(p.identity); this.analizEkle(p.identity, track as RemoteAudioTrack); } this.tazele(); })
          .on(RoomEvent.TrackUnsubscribed, (track, _pub, p) => { track.detach(); this.analizSil(p.identity); this.tazele(); })
          .on(RoomEvent.Disconnected, () => { this.room = null; this.mikrofonuKapat(); this.analizleriTemizle(); this.yay({ bagli: false, baglaniyor: false, oda: null, etiket: null, savasId: null, partyId: null, mikrofon: false, katilimcilar: [] }); })
          .on(RoomEvent.Reconnecting, () => this.yay({ baglaniyor: true }))
          .on(RoomEvent.Reconnected, () => this.yay({ baglaniyor: false }));
      await room.connect(t.url, t.token);
      this.room = room;
      await this.anonsaBaglan(api);
      await room.startAudio().catch(() => {});
      if (this.ayar.hoparlor) await room.switchActiveDevice("audiooutput", this.ayar.hoparlor).catch(() => {});
      const acik = !this.pttKod; // PTT varsa kapalı başlar
      this.yay({ bagli: true, baglaniyor: false, oda: t.room, etiket: t.label, savasId: warId, partyId: t.partyId ?? null, mikrofon: acik, ptt: !!this.pttKod });
      // Mikrofon açılamazsa (izin yok vb.) odadan düşme: dinleyici olarak kal,
      // hatayı söyle. Eskiden burada room=null yapılıp bağlantı kesilmiyordu;
      // kişi sunucuda odada "hayalet" kalıyor, iki odada birden görünüyordu.
      try { await this.mikrofonuKur(true); }
      catch (e) { this.yay({ mikrofon: false, hata: mikrofonHatasi(e) }); }
      this.tazele();
    } catch (e) {
      const r = this.room; this.room = null; this.mikrofonuKapat();
      await this.anonstanAyril();
      if (r) await r.disconnect().catch(() => {});
      this.yay({ bagli: false, baglaniyor: false, hata: (e as Error).message });
    }
  }

  async ayril() {
    const r = this.room; this.room = null;
    this.mikrofonuKapat(); this.analizleriTemizle();
    await this.anonstanAyril();
    if (r) await r.disconnect();
    this.yay({ bagli: false, baglaniyor: false, oda: null, etiket: null, savasId: null, partyId: null, mikrofon: false, katilimcilar: [] });
  }

  async mikrofon(acik: boolean) {
    if (!this.room) return;
    if (acik && this.durum.sagir) return; // sağırken mikrofon açılmaz
    if (acik && !this.ham) {
      // Odaya girerken mikrofon açılamamıştı (izin vb.) — şimdi tekrar dene
      this.yay({ mikrofon: true });
      try { await this.mikrofonuKur(true); } catch (e) { this.yay({ mikrofon: false, hata: mikrofonHatasi(e) }); }
      this.tazele(); return;
    }
    if (this.yayin) { if (acik) await this.yayin.unmute(); else await this.yayin.mute(); }
    this.yay({ mikrofon: acik }); this.tazele();
    await this.anonsGuncelle();
  }

  // ---- Konuşma göstergesi (yerel analizör) ----

  private analizEkle(anahtar: string, track: RemoteAudioTrack) {
    this.analizSil(anahtar);
    try {
      const a = createAudioAnalyser(track, { fftSize: 256, smoothingTimeConstant: 0.2 });
      this.analizler.set(anahtar, { hacim: a.calculateVolume, kapat: a.cleanup, son: 0 });
    } catch { return; }
    if (this.konusmaZamanlayici) return;
    this.konusmaZamanlayici = window.setInterval(() => {
      const t = performance.now(); let degisti = false;
      for (const [k, a] of Array.from(this.analizler)) {
        if (a.hacim() > 0.04) a.son = t;
        const on = t - a.son < 200;
        if (on !== this.konusanlar.has(k)) { if (on) this.konusanlar.add(k); else this.konusanlar.delete(k); degisti = true; }
      }
      if (degisti) { this.tazele(); this.anonsKonusanlariTazele(); }
    }, 60);
  }
  private analizSil(anahtar: string) {
    const a = this.analizler.get(anahtar);
    if (a) { void a.kapat().catch(() => {}); this.analizler.delete(anahtar); }
    this.konusanlar.delete(anahtar);
    if (this.analizler.size === 0 && this.konusmaZamanlayici) { clearInterval(this.konusmaZamanlayici); this.konusmaZamanlayici = null; }
  }
  private analizleriTemizle() { for (const k of Array.from(this.analizler.keys())) this.analizSil(k); }

  // ---- Anons: tüm odalara konuş ----

  private async anonsaBaglan(api: SesApi) {
    await this.anonstanAyril();
    try {
      const t = await api.voiceAnons();
      const oda = new Room({ adaptiveStream: false, dynacast: false, webAudioMix: true });
      oda.on(RoomEvent.TrackSubscribed, (track, _pub, p) => { if (track.kind === Track.Kind.Audio) { track.attach(); this.anonsHacimUygula(p.identity); this.analizEkle(`anons:${p.identity}`, track as RemoteAudioTrack); } })
         .on(RoomEvent.TrackUnsubscribed, (track, _pub, p) => { track.detach(); this.analizSil(`anons:${p.identity}`); })
         .on(RoomEvent.ParticipantConnected, () => this.anonsHacimUygula())
         .on(RoomEvent.ActiveSpeakersChanged, () => this.anonsKonusanlariTazele())
         .on(RoomEvent.ParticipantDisconnected, () => this.anonsKonusanlariTazele())
         .on(RoomEvent.Disconnected, () => { if (this.anons === oda) { this.anons = null; this.anonsYayin = null; this.yay({ anonsAcik: false, anonsKonusanlar: [] }); } });
      await oda.connect(t.url, t.token);
      this.anons = oda;
      await oda.startAudio().catch(() => {});
      if (this.ayar.hoparlor) await oda.switchActiveDevice("audiooutput", this.ayar.hoparlor).catch(() => {});
      this.anonsHacimUygula();
    } catch (e) {
      // Anons olmadan da oda çalışır; sessizce geç, sadece bildir
      this.anons = null;
      this.yay({ hata: `Anons kanalına bağlanılamadı: ${(e as Error).message}` });
    }
  }

  private async anonstanAyril() {
    const a = this.anons; this.anons = null; this.anonsYayin = null;
    if (a) await a.disconnect().catch(() => {});
    this.yay({ anonsAcik: false, anonsKonusanlar: [] });
  }

  /** Anons odasındaki kişi benim odamda da varsa (ya da sağırsam / susturduysam) kopyasını kıs */
  private anonsHacimUygula(sadece?: string) {
    const a = this.anons; if (!a) return;
    const uygula = (p: RemoteParticipant) => {
      const ayniOda = !!this.room?.remoteParticipants.has(p.identity);
      const v = this.durum.sagir || ayniOda || this.susturulan.has(p.identity) ? 0 : (this.hacimler.get(p.identity) ?? 1) * this.ayar.cikis;
      try { p.setVolume(v); } catch { /* aşağıda toast'lanır */ }
    };
    if (sadece) { const p = a.remoteParticipants.get(sadece); if (p) uygula(p); }
    else a.remoteParticipants.forEach(uygula);
    this.anonsKonusanlariTazele();
  }

  private anonsKonusanlariTazele() {
    const a = this.anons; if (!a) { if (this.durum.anonsKonusanlar.length) this.yay({ anonsKonusanlar: [] }); return; }
    const liste: string[] = [];
    a.remoteParticipants.forEach((p) => {
      const k = `anons:${p.identity}`;
      const konusuyor = this.analizler.has(k) ? this.konusanlar.has(k) : p.isSpeaking;
      if (konusuyor && !this.room?.remoteParticipants.has(p.identity)) liste.push(p.name || p.identity);
    });
    if (liste.join("|") !== this.durum.anonsKonusanlar.join("|")) this.yay({ anonsKonusanlar: liste });
  }

  /** Anons kopyası açık mı: otomatikte mikrofonla birlikte, tuşta yalnızca basılıyken */
  private async anonsGuncelle() {
    const y = this.anonsYayin;
    const istenen = !!y && !this.durum.sagir && (this.anonsMod === "otomatik" ? this.durum.mikrofon : this.anonsMod === "tus" && this.anonsBasili);
    if (y) { if (istenen && y.isMuted) await y.unmute(); else if (!istenen && !y.isMuted) await y.mute(); }
    if (istenen !== this.durum.anonsAcik) this.yay({ anonsAcik: istenen });
  }

  /** Anons ayarı (yönetici): mod + tuş. Bağlıyken değişince yayın yeniden kurulur. */
  async anonsAyarla(mod: AnonsMod, kod: string) {
    const degisti = mod !== this.anonsMod;
    this.anonsMod = mod; this.anonsKod = mod === "tus" ? kod : "";
    this.tusDinlemeyiKur();
    if (degisti && this.room && this.ham) await this.mikrofonuKur(true).catch((e) => this.yay({ hata: mikrofonHatasi(e) }));
    else await this.anonsGuncelle();
  }

  private anonsOlay(basili: boolean) {
    if (basili === this.anonsBasili) return;
    this.anonsBasili = basili;
    if (!this.room || this.anonsMod !== "tus") return;
    void (async () => {
      // Anons tuşu = herkese konuş: kendi odam için de mikrofonu aç (PTT/kapalıysa)
      if (basili && !this.durum.mikrofon && !this.durum.sagir) { this.anonsMikActi = true; await this.mikrofon(true); }
      else if (!basili && this.anonsMikActi) { this.anonsMikActi = false; await this.mikrofon(false); }
      await this.anonsGuncelle();
    })();
  }

  /** Etkin ses: susturma ve sağırlık hacmi ezer */
  private uygulaHacim(identity: string) {
    const p = this.room?.remoteParticipants.get(identity); if (!p) return;
    const v = this.durum.sagir || this.susturulan.has(identity) ? 0 : (this.hacimler.get(identity) ?? 1) * this.ayar.cikis;
    try { p.setVolume(v); } catch (e) { this.yay({ hata: `Ses ayarlanamadı: ${(e as Error).message}` }); }
  }
  /** Başkasının sesi: 0–200 (%) */
  hacim(identity: string, yuzde: number) {
    this.hacimler.set(identity, Math.max(0, Math.min(2, yuzde / 100)));
    this.uygulaHacim(identity); this.anonsHacimUygula(identity); this.tazele();
  }
  /** Tek kişiyi sustur / aç */
  sustur(identity: string, sus: boolean) {
    if (sus) this.susturulan.add(identity); else this.susturulan.delete(identity);
    this.uygulaHacim(identity); this.anonsHacimUygula(identity); this.tazele();
  }
  /** Kulaklık: kapalıyken kimseyi duymam ve mikrofonum da kapanır (açınca eski hâline döner) */
  async sagirlik(sagir: boolean) {
    if (sagir) { this.sagirOncesiMik = this.durum.mikrofon; await this.mikrofon(false); this.yay({ sagir: true }); }
    else { this.yay({ sagir: false }); if (!this.pttKod) await this.mikrofon(this.sagirOncesiMik); }
    this.room?.remoteParticipants.forEach((p) => this.uygulaHacim(p.identity));
    this.anonsHacimUygula();
    this.tazele();
  }

  /**
   * PTT tuşu: KeyboardEvent.code ("KeyV", "Space"…) ya da "Mouse4"/"Mouse5"
   * ("" = kapalı). Yalnızca bu sekme odaktayken çalışır; yazı alanında
   * yazarken tuş sayılmaz.
   */
  async pttAyarla(kod: string) {
    this.pttKod = kod;
    this.yay({ ptt: kod !== "" });
    this.tusDinlemeyiKur();
    if (this.room) await this.mikrofon(kod === "");
  }

  private tusDinlemeyiKur() {
    if (this.tusDinleyiciKuruldu || typeof window === "undefined") return;
    this.tusDinleyiciKuruldu = true;
    const yaziAlani = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const dagit = (kod: string, basili: boolean) => {
      if (this.pttKod && kod === this.pttKod) { if (basili !== this.pttBasili) { this.pttBasili = basili; if (this.room) void this.mikrofon(basili); } }
      if (this.anonsKod && kod === this.anonsKod) this.anonsOlay(basili);
    };
    window.addEventListener("keydown", (e) => { if (e.repeat || yaziAlani(e.target)) return; if (e.code === this.pttKod || e.code === this.anonsKod) e.preventDefault(); dagit(e.code, true); });
    window.addEventListener("keyup", (e) => { if (yaziAlani(e.target)) return; dagit(e.code, false); });
    window.addEventListener("mousedown", (e) => { if (e.button === 3 || e.button === 4) { e.preventDefault(); dagit(`Mouse${e.button + 1}`, true); } });
    window.addEventListener("mouseup", (e) => { if (e.button === 3 || e.button === 4) dagit(`Mouse${e.button + 1}`, false); });
    // Sekme arka plana düşünce basılı tuş bırakılmış say
    window.addEventListener("blur", () => { dagit(this.pttKod, false); dagit(this.anonsKod, false); });
  }
}

export const ses = new SesYoneticisi();

export function useSes(): SesDurum {
  const [d, setD] = useState<SesDurum>(ses.durum);
  useEffect(() => ses.abone(setD), []);
  return d;
}

export async function sesCihazlari(): Promise<{ mikrofonlar: Array<{ id: string; ad: string }>; hoparlorler: Array<{ id: string; ad: string }> }> {
  try {
    // Etiketler izin verilmeden boş gelir; kısa bir izin isteği
    const s = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    const list = await navigator.mediaDevices.enumerateDevices();
    s?.getTracks().forEach((t) => t.stop());
    const sec = (k: MediaDeviceKind, on: string) => list.filter((d) => d.kind === k && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d, i) => ({ id: d.deviceId, ad: d.label || `${on} ${i + 1}` }));
    return { mikrofonlar: sec("audioinput", "Mikrofon"), hoparlorler: sec("audiooutput", "Hoparlör") };
  } catch { return { mikrofonlar: [], hoparlorler: [] }; }
}
