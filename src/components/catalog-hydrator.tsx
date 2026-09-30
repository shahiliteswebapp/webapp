"use client";

import { applyCatalogChanges, type LightingSystem } from "@/lib/catalog";

/*
 * Applies the superadmin's catalogue changes (uploaded items, removed items)
 * to the browser's copy of the catalogue. Runs during render, before any
 * child page reads the catalogue.
 */
export function CatalogHydrator({
  items,
  removed,
  children,
}: {
  items: LightingSystem[];
  removed: string[];
  children: React.ReactNode;
}) {
  applyCatalogChanges(items, removed);
  return children;
}
