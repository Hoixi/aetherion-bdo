"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/optimizer/page";

/**
 * Optimizer — mevcut ekran yeni kabuğun içinde.
 *
 * Sayfa yeniden yazılmadı: kendi başlığını ve mantığını taşımaya devam
 * ediyor, eski Tailwind paleti de `bridge.css` üzerinden tema
 * değişkenlerine bağlanıyor. Böylece davranış aynı kalırken görünüm
 * /test ile birleşiyor.
 */
export default function TestOptimizerPage() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
