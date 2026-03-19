import rootConfig from "../../eslint.config.mjs";
import globals from "globals";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";

export default [
  ...rootConfig,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        React: "readonly",
      },
    },
  },
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
      react: reactPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
