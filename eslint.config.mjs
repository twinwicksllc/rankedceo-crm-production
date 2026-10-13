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
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      ...a11yRules,
      "jsx-a11y/label-has-for": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: labelSelector,
          message:
            "<label> needs htmlFor (and a matching id on the control) or must wrap its input. For group headings use <span id> + role=group aria-labelledby.",
        },
      ],
    },
  },
];

export default eslintConfig;
