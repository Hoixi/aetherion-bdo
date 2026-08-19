"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/forum/yeni/page";

/** Yeni Konu — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
