import type { Config } from "tailwindcss";

/** Tailwind scale aligned with Dobby mobile (`DobbyColors`). */
const dobby = {
  50: "#F0F4FF",
  100: "#E0E9FF",
  200: "#C2D4FF",
  300: "#94B4FF",
  400: "#5C8FFF",
  500: "#3380FF",
  600: "#0061FF",
  700: "#004ECC",
  800: "#1D2B4F",
  900: "#15223D",
};

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dobby,
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
        "dobby-page": dobby[50],
      },
    },
  },
  plugins: [],
} satisfies Config;
