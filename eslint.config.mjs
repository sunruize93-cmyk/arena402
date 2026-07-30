import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // React 19 exposes compiler-oriented rules even when the compiler is
      // disabled. Arena's feed and browser-adapter effects intentionally
      // initialize state from subscriptions and clocks; keep the correctness
      // rules below enabled while avoiding a behavior-changing mass rewrite.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    files: ["tests/**/*.mjs"],
    rules: {
      // The lightweight TypeScript harness emulates CommonJS modules inside
      // Node tests. It is not bundled as Next.js application code.
      "@next/next/no-assign-module-variable": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "output/**",
      "build/**",
      ".playwright-cli/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
