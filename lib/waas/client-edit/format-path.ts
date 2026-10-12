/**
 * Human-readable label for a stored edit path, shared by every edit-history
 * surface (history panel, portal home).
 *
 * Section paths use the 0-based position in `sections_json`; we show it
 * 1-based. Handles `.content.`, `.config.` and the bare `.enabled` toggle:
 *   sections[0].content.headline → "Section 1 › Headline"
 *   sections[2].config.layout    → "Section 3 › Settings › Layout"
 *   sections[1].enabled          → "Section 2 › Visibility"
 */
export function formatEditPath(path: string): string {
  return (
    path
      .replace(
        /^sections\[(\d+)\]\.enabled$/,
        (_m, n: string) => `Section ${Number(n) + 1} › Visibility`,
      )
      .replace(
        /^sections\[(\d+)\]\.config\./,
        (_m, n: string) => `Section ${Number(n) + 1} › Settings › `,
      )
      .replace(
        /^sections\[(\d+)\]\.content\./,
        (_m, n: string) => `Section ${Number(n) + 1} › `,
      )
      .replace(/brand_config\./, "Brand › ")
      .replace(/_/g, " ")
      // Capitalise words but keep digits-only tokens untouched.
      .replace(/\b[a-z]/g, (c) => c.toUpperCase())
      .replace(/\s*\.\s*/g, " › ")
  );
}
