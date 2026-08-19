"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/forum/[id]/page";

/** Forum Konusu — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
