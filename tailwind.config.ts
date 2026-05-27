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
          bg: "#07080f",
          surface: "#111122",
          border: "#252538",
          gold: "#d4a030",
          "gold-dim": "#a07820",
          "text-primary": "#eaeaf5",
          "text-secondary": "#6b6b80",
          "text-muted": "#9d9db8",
          "gradient-start": "#141428",
          "gradient-end": "#0a0a16",
          sapphire: "#4a7dc5",
          silver: "#8898b5",
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
