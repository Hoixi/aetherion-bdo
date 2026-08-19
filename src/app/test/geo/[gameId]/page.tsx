"use client";

import { TestShell } from "@/components/test-shell";
import Page from "@/app/geo/[gameId]/page";

/** GeoGuessr Oyunu — mevcut ekran yeni kabuğun içinde. */
export default function Wrapped() {
  return (
    <TestShell bare>
      <Page />
    </TestShell>
  );
}
