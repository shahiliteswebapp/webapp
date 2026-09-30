"use client";

import { registerUploadedSystems, type LightingSystem } from "@/lib/catalog";

/*
 * Merges the superadmin-uploaded catalogue into the browser's copy of the
 * catalogue. Runs during render, before any child page reads the catalogue.
 */
export function CatalogHydrator({
  items,
  children,
}: {
  items: LightingSystem[];
  children: React.ReactNode;
}) {
  registerUploadedSystems(items);
  return children;
}
