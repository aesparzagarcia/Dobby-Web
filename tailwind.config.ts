import type { Config } from "tailwindcss";
import { DOBBY_PURE_SCALE, DOBBY_TAILWIND_SCALE } from "./dobbyPalette";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dobby: { ...DOBBY_TAILWIND_SCALE },
        "dobby-pure": { ...DOBBY_PURE_SCALE },
        "dobby-accent": {
          DEFAULT: "#00C2A8",
          light: "#E6FAF6",
          dark: "#009A86",
        },
        "dobby-warning": {
          DEFAULT: "#FFB800",
          light: "#FFF4D6",
        },
      },
      backgroundColor: {
        "dobby-page": DOBBY_PURE_SCALE.fog,
      },
    },
  },
  plugins: [],
} satisfies Config;
