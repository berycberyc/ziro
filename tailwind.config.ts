import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16233F",
        "ink-soft": "#1E2E52",
        parchment: "#F3F5F2",
        parent: {
          DEFAULT: "#2451B0",
          soft: "#E8EEFB",
        },
        teacher: {
          DEFAULT: "#C4711F",
          soft: "#FBEEE0",
        },
        admin: {
          DEFAULT: "#16233F",
          soft: "#E7E7EC",
        },
        gold: {
          DEFAULT: "#C69A3A",
          deep: "#A87F26",
        },
        mint: "#2C7A66",
        clay: "#B4483F",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
