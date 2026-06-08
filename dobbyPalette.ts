/**
 * Escala pura — shared by Tailwind config and app code.
 * Keep this file outside `src/` so PostCSS/Tailwind never pull app modules into webpack.
 */
export const DOBBY_PURE_SCALE = {
  onyx: "#0D0D0D",
  carbon: "#1F1F1F",
  graphite: "#3A3A3A",
  ash: "#8A8A8A",
  mist: "#E8E8E8",
  fog: "#F5F5F5",
  pure: "#FFFFFF",
} as const;

export const DOBBY_TAILWIND_SCALE = {
  50: DOBBY_PURE_SCALE.fog,
  100: DOBBY_PURE_SCALE.mist,
  200: "#D4D4D4",
  300: "#BDBDBD",
  400: DOBBY_PURE_SCALE.ash,
  500: DOBBY_PURE_SCALE.graphite,
  600: DOBBY_PURE_SCALE.onyx,
  700: "#000000",
  800: DOBBY_PURE_SCALE.carbon,
  900: DOBBY_PURE_SCALE.onyx,
} as const;
