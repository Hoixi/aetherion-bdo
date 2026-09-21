export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { livekitAyar } from "@/lib/livekit";
import { sesOlayiIsle } from "@/lib/voice-presence";

/**
 * LiveKit webhook'u: biri odaya girince/çıkınca sunucu buraya POST atar
 * (livekit.yaml → webhook.urls). İmza Authorization başlığındaki JWT ile
 * doğrulanır; API anahtarıyla imzalanmamış istek reddedilir.
 */
export async function POST(req: Request) {
  const a = livekitAyar(); if (!a) return NextResponse.json({ error: "LiveKit ayarlı değil" }, { status: 503 });
  const body = await req.text();
  const auth = req.headers.get("authorization") ?? "";
  try {
    const ev = await new WebhookReceiver(a.key, a.secret).receive(body, auth);
    sesOlayiIsle({ event: ev.event, room: ev.room ? { name: ev.room.name } : undefined, participant: ev.participant ? { identity: ev.participant.identity, name: ev.participant.name } : undefined });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[livekit-webhook]", (e as Error).message);
    return NextResponse.json({ error: "imza geçersiz" }, { status: 401 });
  }
}
