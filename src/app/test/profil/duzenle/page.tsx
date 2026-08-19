"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/profile/page";

/** Profil Düzenleme — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
