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
        bdo: {
          bg: "#0a0a0f",
          surface: "#141420",
          border: "#2a2a35",
          gold: "#c8a64b",
          "gold-dim": "#a88b2f",
          "text-primary": "#e8e8f0",
          "text-secondary": "#6b6b7b",
          "text-muted": "#9d9daa",
          "gradient-start": "#1a1a25",
          "gradient-end": "#0f0f18",
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
