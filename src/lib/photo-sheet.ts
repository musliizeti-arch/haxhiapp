type PhotoItem = { src: string; name: string; subtitle?: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Hap një skedë të re vetëm me fotografitë portret mbi sfond të bardhë — pa asnjë të dhënë tjetër. */
export function openPhotoSheet(items: PhotoItem[], title = "Fotografitë") {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank");
  if (!win) return false;

  const cards = items
    .map((item) => `<figure class="card"><img src="${item.src}" alt="${escapeHtml(item.name)}" /></figure>`)
    .join("");

  win.document.write(`<!doctype html>
<html lang="sq"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; padding: 28px; font-family: system-ui, sans-serif; }
  .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .card { margin: 0; background: #fff; break-inside: avoid; }
  .card img { width: 100%; aspect-ratio: 35 / 45; object-fit: cover; background: #fff; display: block; }
  .toolbar { margin-bottom: 18px; }
  button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid #d1d5db;
           background: #f9fafb; cursor: pointer; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Printo / Ruaj si PDF</button></div>
  <div class="grid">${cards}</div>
</body></html>`);
  win.document.close();
  return true;
}
