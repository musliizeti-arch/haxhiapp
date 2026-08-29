type PhotoItem = { src: string; name: string; subtitle?: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Hap një skedë të re me fotografitë e pasaportave mbi sfond të bardhë, me emrin poshtë secilës. */
export function openPhotoSheet(items: PhotoItem[], title = "Fotografitë e pasaportave") {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank");
  if (!win) return false;

  const cards = items
    .map(
      (item) => `
      <figure class="card">
        <img src="${item.src}" alt="${escapeHtml(item.name)}" />
        <figcaption>
          <span class="name">${escapeHtml(item.name || "—")}</span>
          ${item.subtitle ? `<span class="sub">${escapeHtml(item.subtitle)}</span>` : ""}
        </figcaption>
      </figure>`,
    )
    .join("");

  win.document.write(`<!doctype html>
<html lang="sq"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: #111827;
         font-family: "IBM Plex Sans", system-ui, sans-serif; padding: 28px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.meta { margin: 0 0 24px; font-size: 12px; color: #6b7280; }
  .grid { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  .card { margin: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 12px; text-align: center; break-inside: avoid; }
  .card img { width: 100%; height: 190px; object-fit: contain; background: #fff; display: block; }
  figcaption { margin-top: 10px; display: flex; flex-direction: column; gap: 2px; }
  .name { font-size: 13px; font-weight: 600; }
  .sub { font-size: 11px; color: #6b7280; font-family: ui-monospace, monospace; }
  .toolbar { margin-bottom: 18px; }
  button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid #d1d5db;
           background: #f9fafb; cursor: pointer; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${items.length} fotografi • HAXHI.app</p>
  <div class="toolbar"><button onclick="window.print()">Printo / Ruaj si PDF</button></div>
  <div class="grid">${cards}</div>
</body></html>`);
  win.document.close();
  return true;
}
