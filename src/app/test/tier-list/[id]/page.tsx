"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/tier-list/[id]/page";

/**
 * Tier List — mevcut ekran yeni kabuğun içinde.
 *
 * Bu sayfa `params`'i prop olarak alıyor (useParams değil), o yüzden
 * aynen geçiriliyor.
 */
export default function Wrapped({ params }: { params: { id: string } }) {
  return (
    <TestShell bare>
      <Page params={params} />
    </TestShell>
  );
}
