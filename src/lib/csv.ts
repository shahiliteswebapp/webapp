/** Build an RFC-4180-ish CSV string. Leading BOM so Excel reads UTF-8. */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const esc = (v: string | number | null | undefined) => {
    const str = v == null ? "" : String(v);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return (
    "﻿" +
    [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
  );
}
