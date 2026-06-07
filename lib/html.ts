// Escape text before interpolating into innerHTML (e.g. Leaflet popups).
export function htmlEscape(s: string): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
