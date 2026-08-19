import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Renkler CSS degiskeninden okunuyor ki /test kabugu ayni
        // siniflari yeniden boyayabilsin. <alpha-value> sayesinde
        // bg-bdo-surface/60 gibi turevler de dogru calisiyor.
        bdo: {
          bg: "rgb(var(--bdo-bg) / <alpha-value>)",
          surface: "rgb(var(--bdo-surface) / <alpha-value>)",
          "surface-2": "rgb(var(--bdo-surface-2) / <alpha-value>)",
          border: "rgb(var(--bdo-border) / <alpha-value>)",
          "border-2": "rgb(var(--bdo-border-2) / <alpha-value>)",
          gold: "rgb(var(--bdo-gold) / <alpha-value>)",
          "gold-dim": "rgb(var(--bdo-gold-dim) / <alpha-value>)",
          "text-primary": "rgb(var(--bdo-text-primary) / <alpha-value>)",
          "text-secondary": "rgb(var(--bdo-text-secondary) / <alpha-value>)",
          "text-muted": "rgb(var(--bdo-text-muted) / <alpha-value>)",
          "gradient-start": "rgb(var(--bdo-surface) / <alpha-value>)",
          "gradient-end": "rgb(var(--bdo-bg) / <alpha-value>)",
          sapphire: "rgb(var(--bdo-sapphire) / <alpha-value>)",
          silver: "rgb(var(--bdo-silver) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
