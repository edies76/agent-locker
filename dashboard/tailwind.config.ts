import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0d0f1a",
          card: "#141728",
          border: "#1e2444",
          sidebar: "#0a0c18",
        },
      },
    },
  },
  plugins: [],
}

export default config
