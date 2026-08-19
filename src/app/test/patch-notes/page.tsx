"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/patch-notes/page";

/** Yama Notları — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
