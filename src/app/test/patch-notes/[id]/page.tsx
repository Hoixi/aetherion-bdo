"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/patch-notes/[id]/page";

/** Yama Notu — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
