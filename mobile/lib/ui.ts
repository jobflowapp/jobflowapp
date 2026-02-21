// mobile/lib/ui.ts
export const COLORS = {
  bg: "#05070D",
  card: "#0B1220",
  card2: "#0B1220",          // alias
  panel: "#0F1930",
  input: "#0F1930",          // alias
  text: "#EAF0FF",
  muted: "rgba(234,240,255,0.65)",
  border: "rgba(234,240,255,0.12)",
  accent: "#2F80FF",
  primary: "#2F80FF",        // alias
  danger: "#FF4D4D",
  red: "#FF4D4D",            // alias

success: "#22C55E",

};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  screenX: 18,               // used by some screens
} as const;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
} as const;

// single shadow style (spread-friendly: ...SHADOW)
export const SHADOW = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
}
