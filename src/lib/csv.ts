/** CSV opérationnel : échappement RFC 4180 et neutralisation des formules tableur. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Une cellule issue d'un nom, d'une référence ou d'un code ne doit jamais
  // être interprétée comme une formule par Excel/LibreOffice.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRows(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
