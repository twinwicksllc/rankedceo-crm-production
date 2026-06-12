import type { Block } from "./blocks"

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case "hero": {
      const align =
        block.align === "center"
          ? "text-align:center;align-items:center;"
          : "text-align:left;align-items:flex-start;"
      return `      <section class="block hero" style="${align}">
        <p class="eyebrow">${esc(block.eyebrow)}</p>
        <h1>${esc(block.title)}</h1>
        <p class="subtitle">${esc(block.subtitle)}</p>
        <a class="btn btn-solid" href="#">${esc(block.buttonLabel)}</a>
      </section>`
    }
    case "heading":
      return `      <${block.level} class="block heading" style="text-align:${block.align}">${esc(block.text)}</${block.level}>`
    case "text":
      return `      <p class="block text" style="text-align:${block.align}">${esc(block.text)}</p>`
    case "image":
      return `      <figure class="block image">
        <img src="${esc(block.src)}" alt="${esc(block.alt)}"${block.rounded ? ' style="border-radius:12px"' : ""} />
      </figure>`
    case "button": {
      const cls = block.variant === "solid" ? "btn-solid" : "btn-outline"
      return `      <div class="block button-block" style="text-align:${block.align}">
        <a class="btn ${cls}" href="${esc(block.href)}">${esc(block.label)}</a>
      </div>`
    }
    case "columns":
      return `      <div class="block columns">
        <div>${esc(block.left)}</div>
        <div>${esc(block.right)}</div>
      </div>`
    case "spacer": {
      const h = block.size === "sm" ? 24 : block.size === "lg" ? 96 : 56
      return `      <div class="block spacer" style="height:${h}px"></div>`
    }
    case "divider":
      return `      <hr class="block divider" />`
  }
}

export function exportHtml(blocks: Block[], title = "My Page"): string {
  const body = blocks.map(renderBlock).join("\n")
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; line-height: 1.6; background: #fff; }
    .page { max-width: 768px; margin: 0 auto; padding: 48px 24px; display: flex; flex-direction: column; gap: 20px; }
    .hero { display: flex; flex-direction: column; gap: 16px; padding: 48px 0; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; font-weight: 600; color: #6366f1; }
    h1 { font-size: 44px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; }
    h2 { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
    h3 { font-size: 22px; font-weight: 600; }
    .subtitle { font-size: 18px; color: #555; max-width: 560px; }
    .text { font-size: 16px; color: #333; }
    .image img { width: 100%; height: auto; display: block; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .divider { border: none; border-top: 1px solid #e5e5e5; }
    .btn { display: inline-block; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px; }
    .btn-solid { background: #111; color: #fff; }
    .btn-outline { border: 1px solid #111; color: #111; }
    @media (max-width: 600px) { h1 { font-size: 34px; } .columns { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="page">
${body}
  </main>
</body>
</html>`
}
