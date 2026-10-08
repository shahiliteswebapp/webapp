"use client";

import { applyCatalogChanges, type CatalogDelta } from "@/lib/catalog";

/*
 * Applies the catalogue changes (uploaded, edited, popular and removed items)
 * to the browser's copy of the catalogue. Runs during render, before any
 * child page reads the catalogue.
 */
export function CatalogHydrator({
  changes,
  children,
}: {
  changes: CatalogDelta;
  children: React.ReactNode;
}) {
  applyCatalogChanges(changes);
  return children;
}
