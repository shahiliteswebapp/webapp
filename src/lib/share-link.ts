import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Share links: a quotation's creator (or the superadmin) can hand a link to a
 * teammate, who opens it in the wizard and edits it like their own. The link
 * carries an HMAC of the quotation number, keyed from AUTH_SECRET, so it only
 * works for that one quotation and cannot be guessed. Only signed-in team
 * members get past the sign-in allow-list, so a link never reaches outsiders.
 */

function secret(): string {
  return process.env.AUTH_SECRET || "shahi-lites-local-dev-only";
}

export function shareKeyFor(number: string): string {
  return createHmac("sha256", `shahi-lites-share|${secret()}`)
    .update(number)
    .digest("base64url")
    .slice(0, 22);
}

export function isValidShareKey(number: string, key: unknown): boolean {
  if (typeof key !== "string" || !key) return false;
  const want = Buffer.from(shareKeyFor(number));
  const got = Buffer.from(key);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Path (no origin) a teammate opens to edit the quotation. */
export function sharePath(number: string): string {
  return `/new/edit/${encodeURIComponent(number)}?share=${shareKeyFor(number)}`;
}
