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
          bg: "#0c0f15",
          surface: "#131820",
          "surface-2": "#1a2233",
          border: "#1e2a3c",
          "border-2": "#2a3a52",
          gold: "#d4a030",
          "gold-dim": "#9a7020",
          "text-primary": "#dce4f2",
          "text-secondary": "#4d5c73",
          "text-muted": "#7a8ba3",
          "gradient-start": "#131820",
          "gradient-end": "#0c0f15",
          sapphire: "#4a7cf5",
          silver: "#7a8ba3",
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
