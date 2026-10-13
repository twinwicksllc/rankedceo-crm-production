// ESLint 9 flat config. Replaces .eslintrc.json (eslint-config-next 16 only
// ships flat configs and needs ESLint >= 9).
//
// Kept the same as before:
//  - scope: .ts/.tsx only (the old script was `eslint . --ext .ts,.tsx`)
//  - a11y: see a11yRules below.
//  - @typescript-eslint/no-unused-vars stays an ERROR. The v16 preset lowers it
//    to a warning, and scripts/lint-changed.mjs only counts errors, so without
//    this override the "no new lint errors" gate would stop catching unused code.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// jsx-a11y "recommended" rules as errors (the Next preset only enables 6 of
// them, as warnings). Old violations are not blocked: scripts/lint-changed.mjs
// only fails a file that gets MORE errors of a rule than it had on main.
// label-has-for is turned off: it is deprecated and duplicates
// label-has-associated-control.
const a11yRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([name, value]) => [
    name,
    Array.isArray(value) ? ["error", ...value.slice(1)] : "error",
  ]),
);

// jsx-a11y/label-has-associated-control misses labels whose text mixes
// `{" "}` and nested elements (found by review on #282), so this is a second,
// stricter check: a <label> must have htmlFor or contain its own
// input/select/textarea. Group headings should be a <span> with
// role="group" + aria-labelledby on the container, not a <label>.
const labelSelector =
  "JSXElement[openingElement.name.name='label']" +
  ":not(:has(JSXOpeningElement[name.name=/^(input|select|textarea)$/]))" +
  ":not(:has(JSXAttribute[name.name='htmlFor']))";

const labelMessage =
  "<label> needs htmlFor (and a matching id on the control) or must wrap its input. For group headings use <span id> + role=group aria-labelledby.";

// jsx-a11y/anchor-is-valid only sees literal href values. A link list like
// `{ label: "Blog", href: "#" }` rendered as `href={link.href}` slips past it
// (found by review on #283), so ban placeholder hrefs in data objects too.
const placeholderHrefSelector =
  "Property[key.name='href'][value.value=/^(#|javascript:.*)$/]";

const placeholderHrefMessage =
  "Placeholder href. Use a real URL, or leave href out and render the item as text.";

// jsx-a11y/control-has-associated-label treats any self-closing component
// (<X />, <ArrowLeft />) as a possible label, so an icon-only button is never
// flagged. This local rule fails a button/link whose children are only icons:
// no text, no {expression}, no aria-label/aria-labelledby/alt anywhere inside,
// no spread props. title="..." alone does not count. A child element that takes
// props other than icon styling (<AppointmentCard appointment=... />,
// <Image alt=... />) renders its own content, so it is not treated as an icon
// (the rule cannot look inside custom components).
const ICON_PROPS = /^(className|aria-hidden|strokeWidth|size|style)$/;
const CONTROL_NAMES = new Set(["button", "Button", "a", "Link"]);

function hasAttr(opening, test) {
  return opening.attributes.some(
    (attr) =>
      attr.type === "JSXSpreadAttribute" || (attr.name && test(attr.name.name)),
  );
}

function rendersContent(node) {
  if (node.type === "JSXText") return node.value.trim().length > 0;
  if (node.type === "JSXExpressionContainer") {
    return node.expression.type !== "JSXEmptyExpression";
  }
  if (node.type === "JSXFragment") return node.children.some(rendersContent);
  if (node.type !== "JSXElement") return false;
  const opening = node.openingElement;
  if (
    hasAttr(opening, (name) => /^(aria-label|aria-labelledby|alt)$/.test(name))
  ) {
    return true;
  }
  if (node.children.length > 0) return node.children.some(rendersContent);
  return hasAttr(opening, (name) => !ICON_PROPS.test(name));
}

const iconOnlyControlRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      noName:
        "Button/link with only an icon needs an accessible name: add aria-label (title alone is not enough) or visible text.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (
          opening.name.type !== "JSXIdentifier" ||
          !CONTROL_NAMES.has(opening.name.name)
        ) {
          return;
        }
        if (
          hasAttr(opening, (name) =>
            /^(aria-label|aria-labelledby)$/.test(name),
          )
        ) {
          return;
        }
        if (node.children.some(rendersContent)) return;
        context.report({ node, messageId: "noName" });
      },
    };
  },
};

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "**/node_modules/**",
      "out/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    plugins: { local: { rules: { "icon-only-control": iconOnlyControlRule } } },
    rules: {
      "local/icon-only-control": "error",
      "@typescript-eslint/no-unused-vars": "error",
      ...a11yRules,
      "jsx-a11y/label-has-for": "off",
      // Stock options plus: td/th are table cells, not controls (the rule
      // flags them when their text sits more than 2 levels deep); depth 6 so
      // text inside a few wrapper divs counts; and the project's own
      // Link/Button components are treated as controls, so an icon-only
      // <Button><Icon/></Button> is caught like a plain <button>.
      "jsx-a11y/control-has-associated-label": [
        "error",
        {
          ignoreElements: [
            "audio",
            "canvas",
            "embed",
            "input",
            "textarea",
            "tr",
            "td",
            "th",
            "video",
          ],
          ignoreRoles: [
            "grid",
            "listbox",
            "menu",
            "menubar",
            "radiogroup",
            "row",
            "tablist",
            "toolbar",
            "tree",
            "treegrid",
          ],
          includeRoles: ["alert", "dialog"],
          depth: 6,
          controlComponents: ["Link", "Button"],
        },
      ],
      // Also check next/link: <Link href="#"> is the same problem as <a href="#">.
      "jsx-a11y/anchor-is-valid": ["error", { components: ["Link"] }],
      "no-restricted-syntax": [
        "error",
        { selector: labelSelector, message: labelMessage },
        { selector: placeholderHrefSelector, message: placeholderHrefMessage },
      ],
    },
  },
  {
    // The website-builder button block ships with href: "#" as the default
    // until the editor sets a real URL (ButtonBlock.href is required, and
    // export-html.ts renders it). Intentional placeholder, not a link list.
    // Fix belongs with the builder work, not this a11y PR.
    files: ["lib/waas/website-builder/blocks.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];

export default eslintConfig;
