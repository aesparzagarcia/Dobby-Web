import { DOBBY_PURE_SCALE, DOBBY_TAILWIND_SCALE } from "../../dobbyPalette";

export { DOBBY_PURE_SCALE, DOBBY_TAILWIND_SCALE };

/**
 * Tokens semánticos (paridad con Android `DobbyColors` e iOS `DobbyBrandColor`).
 */
export const DOBBY_COLORS = {
  navHeader: DOBBY_PURE_SCALE.onyx,
  textPrimary: DOBBY_PURE_SCALE.onyx,
  textSecondary: DOBBY_PURE_SCALE.ash,
  iconBorder: DOBBY_PURE_SCALE.graphite,
  cardSurface: DOBBY_PURE_SCALE.pure,
  screenBackground: DOBBY_PURE_SCALE.fog,
  divider: DOBBY_PURE_SCALE.mist,
  surfaceMuted: DOBBY_PURE_SCALE.fog,
  primary: DOBBY_PURE_SCALE.onyx,
  onPrimary: DOBBY_PURE_SCALE.pure,
  dark: DOBBY_PURE_SCALE.onyx,
  light: DOBBY_PURE_SCALE.fog,
  carbon: DOBBY_PURE_SCALE.carbon,
  accent: "#00C2A8",
  warning: "#FFB800",
} as const;

/** @deprecated Prefer `DOBBY_COLORS` or Tailwind `dobby-*` tokens. */
export const DOBBY_BRAND = {
  primary: DOBBY_COLORS.primary,
  accent: DOBBY_COLORS.accent,
  light: DOBBY_COLORS.light,
  dark: DOBBY_COLORS.dark,
  warning: DOBBY_COLORS.warning,
} as const;
