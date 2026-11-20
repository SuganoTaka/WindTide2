import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        "paper-2": "rgb(var(--paper-2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        "ink-3": "rgb(var(--ink-3) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        teal: "rgb(var(--teal) / <alpha-value>)",
        "teal-2": "rgb(var(--teal-2) / <alpha-value>)",
        shoal: "rgb(var(--shoal) / <alpha-value>)",
        signal: "rgb(var(--signal) / <alpha-value>)",
        sand: "rgb(var(--sand) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        panel: "0 1px 0 rgba(14,42,51,.06), 0 12px 32px -18px rgba(14,42,51,.45)",
        float: "0 18px 48px -20px rgba(14,42,51,.5)",
      },
    },
  },
  plugins: [],
};

export default config;
