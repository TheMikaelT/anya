import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deck: {
          950: "#171d25",
          900: "#1e2630",
          850: "#252f3a",
          800: "#2b3642",
          700: "#3a4856"
        }
      },
      boxShadow: {
        glow: "0 18px 44px rgba(10, 15, 22, 0.22)"
      }
    }
  },
  plugins: []
} satisfies Config;
