export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { withApp, APP_HEADERS } from "@/lib/app-gate";
import { sesAbone, sesTablosu, type SesOlayi } from "@/lib/voice-presence";

/**
 * Oda doluluğu — canlı akış (SSE). İlk mesaj tam tablo, sonra her giriş/çıkışta
 * güncel tablo. 25 sn'de bir boş yorum satırı (bağlantı ölmesin).
 * Site EventSource ile (çerez), uygulama fetch+ReadableStream ile (Bearer) okur.
 */
export async function GET(req: Request) {
  return withApp(req, async () => {
    const enc = new TextEncoder();
    let kapat: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const gonder = (o: SesOlayi) => { try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { kapat?.(); } };
        gonder({ tur: "senkron", odalar: await sesTablosu() });
        const iptal = sesAbone(gonder);
        const nabiz = setInterval(() => { try { ctrl.enqueue(enc.encode(": nabız\n\n")); } catch { kapat?.(); } }, 25_000);
        kapat = () => { clearInterval(nabiz); iptal(); try { ctrl.close(); } catch { /* kapalı */ } kapat = null; };
        req.signal.addEventListener("abort", () => kapat?.());
      },
      cancel() { kapat?.(); },
    });
    return new Response(stream, { headers: { ...APP_HEADERS, "Content-Type": "text/event-stream", "Connection": "keep-alive", "X-Accel-Buffering": "no" } });
  });
}
