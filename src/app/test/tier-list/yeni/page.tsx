"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/tier-list/yeni/page";

/** Yeni Tier List — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
