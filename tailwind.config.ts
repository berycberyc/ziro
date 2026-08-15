import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151A2E",
        parchment: "#F6F4EE",
        parent: {
          DEFAULT: "#2451B0",
          soft: "#E8EEFB",
        },
        teacher: {
          DEFAULT: "#C4711F",
          soft: "#FBEEE0",
        },
        admin: {
          DEFAULT: "#1C2036",
          soft: "#E7E7EC",
        },
        gold: "#D6A83A",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};

export default config;
