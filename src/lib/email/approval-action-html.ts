function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderApprovalActionResultPage(input: {
  ok: boolean;
  approved: boolean;
  title: string;
  message: string;
  eventName?: string;
  detailUrl?: string;
}): string {
  const accent = input.ok
    ? input.approved
      ? "#15803d"
      : "#b91c1c"
    : "#a16207";
  const bg = input.ok
    ? input.approved
      ? "#f0fdf4"
      : "#fef2f2"
    : "#fffbeb";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} · MVQro Espacios</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f8f7f5; margin: 0; padding: 24px; color: #1c1917; }
    .card { max-width: 420px; margin: 10vh auto 0; background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.08); overflow: hidden; }
    .banner { background: ${bg}; border-bottom: 3px solid ${accent}; padding: 20px 22px; }
    .banner h1 { margin: 0 0 8px; font-size: 1.25rem; color: ${accent}; }
    .banner p { margin: 0; font-size: 0.95rem; line-height: 1.45; color: #44403c; }
    .body { padding: 18px 22px 22px; font-size: 0.9rem; color: #57534e; }
    .event { margin-top: 8px; font-weight: 600; color: #292524; }
    a.link { color: #6b5344; }
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      ${input.eventName ? `<p class="event">${escapeHtml(input.eventName)}</p>` : ""}
    </div>
    <div class="body">
      <p>Puedes cerrar esta pestaña y volver a tu correo.</p>
      ${
        input.detailUrl
          ? `<p><a class="link" href="${escapeHtml(input.detailUrl)}">Ver detalle en la aplicación</a></p>`
          : ""
      }
    </div>
  </div>
</body>
</html>`;
}
